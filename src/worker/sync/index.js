const cron = require('node-cron')
const syncMarketData = require('../queues/sync-market')

const task = cron.schedule('*/15 * * * * *', () => {
  syncMarketData()
})

module.exports.start = () => {
  task.start()
}

module.exports.stop = () => {
  task.stop()
}
