const Sentry = require('@sentry/node')
const _ = require('lodash')

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const debug = require('debug')('liquality:agent:worker')

const mongoose = require('mongoose')
const Agenda = require('agenda')

const config = require('../config')
const Order = require('../models/Order')

const JOBS_DIR = path.join(__dirname, 'jobs')

let agenda

const getStatusCode = e => _.get(e, 'statusCode') || _.get(e, 'response.status') || _.get(e, 'response.statusCode', '')
const getResponse = e => _.get(e, 'response.data') || _.get(e, 'response.body', '')
const getRequestUrl = e => _.get(e, 'config.url', '')

const CONCURRENCY_MAP = {
  'agent-claim': 1,
  'find-claim-tx-or-refund': 1,
  'reciprocate-init-swap': 1
}

module.exports.start = async () => {
  agenda = new Agenda({ mongo: mongoose.connection })

  fs.readdirSync(JOBS_DIR)
    .forEach(jobSlug => {
      const jobName = path.basename(jobSlug, '.js')
      const jobOpts = {}

      if (CONCURRENCY_MAP[jobName]) {
        jobOpts.concurrency = CONCURRENCY_MAP[jobName]
      }

      agenda.define(jobName, jobOpts, async (job, done) => {
        const fn = require(path.join(JOBS_DIR, jobSlug))(agenda)

        fn(job)
          .then(() => done())
          .catch(e => done(e))
      })
    })

  if (config.worker.jobReporter) {
    ;['start', 'success', 'fail'].forEach(event => {
      agenda.on(event, async (...args) => {
        const error = JSON.stringify(event.startsWith('fail') ? args[0] : null)
        const job = event.startsWith('fail') ? args[1] : args[0]
        const attrs = JSON.stringify(job.attrs)
        const order = await Order.findOne({ orderId: _.get(job, 'attrs.data.orderId') }).exec()
        const orderJson = JSON.stringify(order)

        spawn(config.worker.jobReporter, [event, error, attrs, orderJson], { stdio: 'inherit' })
      })
    })
  }

  agenda.on('fail', async (err, job) => {
    let delay = config.worker.jobRetryDelay
    const resBody = _.get(err, 'response.body') || _.get(err, 'response.data')

    if (err.message.includes('non-final') || (resBody && typeof resBody.includes === 'function' && resBody.includes('non-final'))) {
      // ignore BTC refund error
      err.ignore = true
      delay = config.worker.backendJobRetryDelay
    } else if (err.name === 'InvalidProviderResponseError' &&
               err.message === 'Provider returned an invalid block,  should be object') {
      // ignore empty blocks on ETH
      err.ignore = true
    } else if (getRequestUrl(err).startsWith('https://blockstream.info/') &&
               (
                 (getStatusCode(err) === 502 && getResponse(err).includes('502 Bad Gateway')) ||
                 err.message.startsWith('getaddrinfo ENOTFOUND')
               )) {
      // ignore blockstream errors for now
      // TODO: replace blockstream with hosted-electrs
      err.ignore = true
    }

    if (err.ignore) {
      debug('[quiet] Retrying', job.attrs)

      job.schedule('in ' + delay)

      await job.save()
      return
    }

    debug(
      _.get(job, 'attrs.name'),
      _.get(job, 'attrs.data.orderId'),
      job.attrs,
      resBody,
      err
    )

    Sentry.withScope(scope => {
      scope.setTag('jobName', _.get(job, 'attrs.name'))
      scope.setTag('orderId', _.get(job, 'attrs.data.orderId'))

      scope.setExtra('attrs', job.attrs)
      scope.setExtra('response_body', resBody)

      Sentry.captureException(err)
    })

    if (job.attrs.failCount <= config.worker.maxJobRetry) {
      debug('Retrying', job.attrs)

      job.schedule('in ' + delay)

      await job.save()
    } else {
      debug('Max attempts reached. Job has failed', job.attrs)
    }
  })

  await agenda.start()
  await agenda.every('30 seconds', 'update-market-data')
}

module.exports.stop = () => {
  if (agenda) {
    agenda.stop().then(() => process.exit(0))
  }
}

process.on('SIGTERM', module.exports.stop)
process.on('SIGINT', module.exports.stop)
