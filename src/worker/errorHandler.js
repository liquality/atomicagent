const Sentry = require('@sentry/node')
const _ = require('lodash')

const debug = require('debug')('liquality:agent:worker:error-handler')

const config = require('../config')

const getStatusCode = e => _.get(e, 'statusCode') || _.get(e, 'response.status') || _.get(e, 'response.statusCode')
const getResponseBody = e => _.get(e, 'response.data') || _.get(e, 'response.body')
const getRequestUrl = e => _.get(e, 'config.url') || e.url
const getRequestData = e => e.data
const getRequestParams = e => e.params

module.exports = async (err, job) => {
  if (
    err.name === 'RescheduleError' ||
    ( // do not retry PossibleTimelockError in production
      process.env.NODE_ENV !== 'production' &&
      err.name === 'PossibleTimelockError'
    )
  ) {
    debug(`[x${job.attrs.failCount}]`, err.name, err.message, job.attrs.name, job.attrs.data)

    const scheduleIn = typeof err.chain === 'string'
      ? 'in ' + config.assets[err.chain].blockTime
      : 'in ' + err.chain + ' seconds'

    job.schedule(scheduleIn)
    return job.save()
  }

  const httpData = {
    req: {
      url: getRequestUrl(err),
      data: getRequestData(err),
      params: getRequestParams(err)
    },
    res: {
      statusCode: getStatusCode(err),
      body: getResponseBody(err)
    }
  }

  debug(
    '[failed]',
    err.name,
    err.message,
    job.attrs,
    httpData
  )

  Sentry.withScope(scope => {
    scope.setTag('httpUrl', httpData.req.url)
    scope.setTag('httpResponseStatusCode', httpData.res.statusCode)
    scope.setTag('jobName', _.get(job, 'attrs.name'))
    scope.setTag('orderId', _.get(job, 'attrs.data.orderId'))

    scope.setExtra('attrs', job.attrs)
    scope.setExtra('httpRequestData', httpData.req.data)
    scope.setExtra('httpRequestParams', httpData.req.params)
    scope.setExtra('httpResponseBody', httpData.res.responseBody)

    Sentry.captureException(err)
  })

  job.fail(err)
  return job.save()
}
