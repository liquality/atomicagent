const { defineFundsJobs } = require('./funds')
const { defineLoansJobs } = require('./loans')

function defineLoanJobs (agenda) {
  defineFundsJobs(agenda)
  defineLoansJobs(agenda)
}

module.exports = {
  defineLoanJobs
}
