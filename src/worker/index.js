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
    defaultConcurrency: 1, // only process one job of a type at a time
    defaultLockLimit: 1, // only one job of a type can be locked at a time
    defaultLockLifetime: 600000 // a job can run for maximum 10 min before it is timedout
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
