const fs = require('fs')
const path = require('path')

const mongoose = require('mongoose')
const Agenda = require('agenda')

const JOBS_DIR = path.join(__dirname, 'jobs')
const agenda = new Agenda({ mongo: mongoose.connection })

fs.readdirSync(JOBS_DIR)
  .forEach(job => {
    const jobName = path.basename(job, '.js')

    agenda.define(jobName, require(path.join(JOBS_DIR, job))(agenda))
  })

async function start () {
  await agenda.start()
  await agenda.every('5 minutes', 'update-market-data')
}

async function stop () {
  await agenda.stop()
  process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
