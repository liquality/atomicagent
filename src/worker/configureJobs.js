const fs = require('fs').promises
const path = require('path')

const JOBS_DIR = path.join(__dirname, 'jobs')

const CONCURRENCY_MAP = {
  'agent-claim': 3,
  'find-claim-tx-or-refund': 3,
  'reciprocate-init-swap': 3,
  'find-refund-tx': 3
}

module.exports = async agenda => {
  const jobs = await fs.readdir(JOBS_DIR)

  jobs.forEach(jobSlug => {
    const jobName = path.basename(jobSlug, '.js')
    const jobOpts = {}

    if (CONCURRENCY_MAP[jobName]) {
      jobOpts.concurrency = CONCURRENCY_MAP[jobName]
    }

    const processor = require(path.join(JOBS_DIR, jobSlug))

    agenda.define(jobName, jobOpts, processor)
  })
}
