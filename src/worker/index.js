const fs = require('fs')
const path = require('path')
const { fork } = require('child_process')
const debug = require('debug')('liquality:agent:worker')

const mongoose = require('mongoose')
const Agenda = require('agenda')

const config = require('../config')

const JOBS_DIR = path.join(__dirname, 'jobs')

let agenda

module.exports.start = async () => {
  agenda = new Agenda({ mongo: mongoose.connection })

  fs.readdirSync(JOBS_DIR)
    .forEach(jobSlug => {
      const jobName = path.basename(jobSlug, '.js')

      agenda.define(jobName, async (job, done) => {
        const fn = require(path.join(JOBS_DIR, jobSlug))(agenda)

        fn(job)
          .then(() => done())
          .catch(e => done(e))
      })
    })

  if (config.jobReporter) {
    ;['start', 'success', 'fail'].forEach(event => {
      agenda.on(event, (...args) => {
        const error = JSON.stringify(event.startsWith('fail') ? args[0] : null)
        const job = event.startsWith('fail') ? args[1] : args[0]
        const attrs = JSON.stringify(job.attrs)

        fork(config.jobReporter, [event, error, attrs])
      })
    })
  }

  agenda.on('fail', async (err, job) => {
    if (err) {}

    if (job.attrs.failCount <= config.worker.maxJobRetry) {
      debug('Retrying', job.attrs)

      job.schedule('in ' + config.worker.jobRetryDelay)

      await job.save()
    } else {
      debug('Max attempts reached. Job has failed', job.attrs)
    }
  })

  await agenda.start()
  await agenda.every('5 minutes', 'update-market-data')
}

module.exports.stop = () => {
  if (agenda) {
    agenda.stop().then(() => process.exit(0))
  }
}

process.on('SIGTERM', module.exports.stop)
process.on('SIGINT', module.exports.stop)
