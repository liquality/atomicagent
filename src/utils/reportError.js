const debug = require('debug')('liquality:agent:report-error')
const Sentry = require('@sentry/node')
const _ = require('lodash')

const getStatusCode = (e) => _.get(e, 'response.status') || _.get(e, 'statusCode') || _.get(e, 'response.statusCode')
const getResponseBody = (e) => _.get(e, 'response.data') || _.get(e, 'response.body')
const getResponseHeaders = (e) => _.get(e, 'response.headers')
const getRequestUrl = (e) => _.get(e, 'config.url') || e.url
const getRequestData = (e) => e.data
const getRequestParams = (e) => e.params

module.exports = (err, tags = {}, extra = {}) => {
  debug(err, tags, extra)

  Sentry.withScope((scope) => {
    scope.setTag('httpUrl', getRequestUrl(err))
    scope.setTag('httpResponseStatusCode', getStatusCode(err))

    scope.setExtra('httpRequestData', getRequestData(err))
    scope.setExtra('httpRequestParams', getRequestParams(err))
    scope.setExtra('httpResponseBody', getResponseBody(err))
    scope.setExtra('httpResponseHeaders', getResponseHeaders(err))

    Object.entries(tags).forEach(([key, value]) => {
      scope.setTag(key, value)
    })

    Object.entries(extra).forEach(([key, value]) => {
      scope.setExtra(key, value)
    })

    Sentry.captureException(err)
  })
}
