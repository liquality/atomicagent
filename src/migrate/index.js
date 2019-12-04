const Market = require('../models/Market')
const markets = require('./data/markets.json')

module.exports.run = async () => {
  await Market.deleteMany({})
  const newMarkets = await Market.insertMany(markets, { ordered: false })

  console.log(`${newMarkets.length} markets have been set`)
  process.exit()
}
