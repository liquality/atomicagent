require('../../utils/sentry')
require('../../utils/mongo').connect()
const debug = require('debug')('liquality:agent:worker:update-market-data')
const Market = require('../../models/Market')

module.exports = async (job) => {
  debug('Running....', job.id)

  await Market.updateAllMarketData()

  return {
    next: [
      {
        name: 'UpdateMarketData'
      }
    ]
  }
}
