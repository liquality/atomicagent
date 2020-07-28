const Market = require('../../models/Market')

module.exports = agenda => async job => {
  await Market.updateAllMarketData()
}
