const Market = require('../../models/Market')

module.exports = async job => {
  await Market.updateAllMarketData()
}
