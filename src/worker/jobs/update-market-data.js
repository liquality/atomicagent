const Market = require('../../models/Market')
// const { RescheduleError } = require('../../utils/errors')

module.exports = async (job) => {
  //TODO testing
  console.log(job)
  Market.updateAllMarketData()
}
