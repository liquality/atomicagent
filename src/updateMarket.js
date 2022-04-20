const mongo = require('./utils/mongo')
const Market = require('./models/Market')

mongo.connect()

async function start() {
  console.log('starting sync market data cron')
  await Market.updateAllMarketData()
}

start()
