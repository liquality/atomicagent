// const mongoose = require('mongoose')
// const Agenda = require('agenda')
// const jobReporter = require('./jobReporter')
const Queue = require('bull')
const configureJobs = require('./configureJobs')
const config = require('../config')
const Sentry = require('@sentry/node')
const _ = require('lodash')
const debug = require('debug')('liquality:agent:worker:error-handler')

const getStatusCode = (e) => _.get(e, 'statusCode') || _.get(e, 'response.status') || _.get(e, 'response.statusCode')
const getResponseBody = (e) => _.get(e, 'response.data') || _.get(e, 'response.body')
const getRequestUrl = (e) => _.get(e, 'config.url') || e.url
const getRequestData = (e) => e.data
const getRequestParams = (e) => e.params

let queue

async function handleError(job, err) {
  if (
    err.name === 'RescheduleError' || // do not retry PossibleTimelockError in production
    (process.env.NODE_ENV !== 'production' && err.name === 'PossibleTimelockError')
  ) {
    debug(`[x${job.attemptsMade}]`, err.name, err.message, job.name, job.data)

    //TODO schedule in x seconds
    const scheduleIn = err.waitFor ? err.waitFor : config.assets[err.asset].blockTime // TODO: blocktime should probably be per chain and in cryptoassets

    //TODO there is no save so will add
    return queue.add(job.name, job.data, { delay: scheduleIn, removeOnFail: true, removeOnComplete: true })
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

  debug('[failed]', err.name, err.message, job.attrs, httpData)

  Sentry.withScope((scope) => {
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

  //TODO there is no save
  //job.fail(err)
  // return job.save()
}

module.exports.start = async () => {
  //TODO update the agenda to queue
  queue = new Queue('agent', process.env.REDIS_URL)

  await configureJobs(queue)

  //TODO do we need this?
  // if (config.worker.jobReporter) {
  //   jobReporter(queue)
  // }

  queue.on('failed', handleError)

  const job = await queue.add(
    'update-market-data',
    {},
    {
      repeat: {
        every: 30000
      },
      removeOnFail: true,
      removeOnComplete: true
    }
  )

  console.log(job)
}

module.exports.stop = async () => {
  if (!queue) return

  //TODO have to be fixed
  //TODO find how to remove stalled jobs
  await queue.close()
}

process.on('SIGTERM', module.exports.stop)
process.on('SIGINT', module.exports.stop)
