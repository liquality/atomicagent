const debug = require('debug')('liquality:agent:worker:update-market-data')

const Market = require('../../models/Market')

module.exports = agenda => async job => {
  debug('Updating market data')

  await Market.updateAllMarketData()
}
