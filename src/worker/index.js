const mongoose = require('mongoose')
const Agenda = require('agenda')

const configureJobs = require('./configureJobs')
const jobReporter = require('./jobReporter')
const handleJobError = require('./handleJobError')
const config = require('../config')

let agenda

module.exports.start = async () => {
  agenda = new Agenda({
    mongo: mongoose.connection,
    defaultConcurrency: 1,
    defaultLockLifetime: config.worker.defaultLockLifetimeInMs
  })

  await configureJobs(agenda)

  if (config.worker.jobReporter) {
    jobReporter(agenda)
  }

  agenda.on('fail', handleJobError)

  await agenda.start()
  await agenda.every('30 seconds', 'update-market-data')
}

module.exports.stop = () => {
  if (!agenda) return

  agenda.stop().then(() => process.exit(0))
}

process.on('SIGTERM', module.exports.stop)
process.on('SIGINT', module.exports.stop)
