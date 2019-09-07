function defineLoanJobs (agenda) {
  agenda.define('verify-create-fund-tx', async (job, done) => {
    const { data } = job.attrs
    console.log('data', data)
    done()
  })
}

module.exports = {
  defineLoanJobs
}
