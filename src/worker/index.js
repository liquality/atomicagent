const cron = require('node-cron')
const Market = require('../models/Market')
const syncMarketData = async () => {
  await Market.updateAllMarketData()
}
const task = cron.schedule('*/15 * * * * *', () => {
  syncMarketData()
})

module.exports.start = () => {
  task.start()
}

module.exports.stop = () => {
  task.stop()
}
