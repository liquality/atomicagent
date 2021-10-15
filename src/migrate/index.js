const Asset = require('../models/Asset')
const Market = require('../models/Market')
const assets = require('./data/assets.json')
const markets = require('./data/markets.json')

const logHeader = '[MIGRATE]'

module.exports.run = async (options = {}) => {
  console.log(`${logHeader} Seeding data...`)
  await Asset.deleteMany({})
  const newAssets = await Asset.insertMany(assets, { ordered: false })
  console.log(`${logHeader} ${newAssets.length} assets have been set`)

  await Market.deleteMany({})
  const newMarkets = await Market.insertMany(markets, { ordered: false })
  console.log(`${logHeader} ${newMarkets.length} markets have been set`)

  process.exit()
}
