const fs = require('fs')
const path = require('path')

const JOBS_DIR = path.join(__dirname, 'jobs')

module.exports = async agenda => {
  const jobs = fs.readdirSync(JOBS_DIR)

  jobs.forEach(jobSlug => {
    const jobName = path.basename(jobSlug, '.js')

    const processor = require(path.join(JOBS_DIR, jobSlug))

    agenda.define(jobName, processor)
  })
}
