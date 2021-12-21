const DEBUG = require('debug')('worker')
const Asset = require('../models/Asset')
const Market = require('../models/Market')
const assets = require('./data/assets.json')
const markets = require('./data/markets.json')

module.exports.run = async () => {
  const force = process.env.FORCE_MIGRATE
  console.log('Running migrate as force?', !!force)

  const keepAlive = process.env.KEEP_ALIVE || false
  DEBUG(`keep alive? ${keepAlive}`)

  if (!force && await hasData()) {
    DEBUG('Data is already seeded.')
  } else {
    DEBUG('Seeding data...')
    await Asset.deleteMany({})
    const newAssets = await Asset.insertMany(assets, { ordered: false })
    DEBUG(`${newAssets.length} assets have been set`)

    await Market.deleteMany({})
    const newMarkets = await Market.insertMany(markets, { ordered: false })
    DEBUG(`${newMarkets.length} markets have been set`)
  }

  if (!keepAlive) process.exit()
}

async function hasData () {
  let result = true

  DEBUG('Checking for existing assets')

  const existingAssets = await Asset.find({}).exec()

  if (!existingAssets || existingAssets.length === 0) {
    DEBUG('No assets found.')
    result = false
  } else {
    DEBUG('Existing assets found:', existingAssets)
  }

  return result
}
