const Asset = require('../models/Asset')
const Market = require('../models/Market')
const assets = require('./data/assets.json')
const markets = require('./data/markets.json')

module.exports.run = async () => {
  console.log('[DEVING] Running migrate...')
  await Asset.deleteMany({})
  const newAssets = await Asset.insertMany(assets, { ordered: false })
  console.log(`${newAssets.length} assets have been set`)

  await Market.deleteMany({})
  const newMarkets = await Market.insertMany(markets, { ordered: false })
  console.log(`${newMarkets.length} markets have been set`)

  // process.exit()
}
