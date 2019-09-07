const mongoose = require('mongoose')
const Agenda = require('agenda')

const agenda = new Agenda({ mongo: mongoose.connection })

const { defineSwapJobs } = require('./swap/index')
const { defineLoanJobs } = require('./loan/index')

async function start () {
  await agenda.start()
  await agenda.every('5 minutes', 'update-market-data')
}

async function stop () {
  await agenda.stop()
  process.exit(0)
}

defineSwapJobs(agenda)
defineLoanJobs(agenda)

process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
