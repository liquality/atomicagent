const objectUtils = require('lodash/object')
const Asset = require('../models/Asset')
const Market = require('../models/Market')
const assets = require('./data/assets.json')
const markets = require('./data/markets.json')

const defaultLog = true
const defaultForce = false
const logHeader = '[MIGRATE]'

module.exports.run = async (options = {}) => {
  console.log(`${logHeader} Running migrate with options:`, options)
  const log = objectUtils.get(options, 'log', defaultLog)
  const force = objectUtils.get(options, 'force', defaultForce)

  if (await hasData() && !force) {
    console.log(`${logHeader} Data is already seeded.`)
  } else {
    console.log(`${logHeader} Seeding data...`)
    await Asset.deleteMany({})
    const newAssets = await Asset.insertMany(assets, { ordered: false })
    console.log(`${logHeader} ${newAssets.length} assets have been set`)

    await Market.deleteMany({})
    const newMarkets = await Market.insertMany(markets, { ordered: false })
    console.log(`${logHeader} ${newMarkets.length} markets have been set`)
  }
}

async function hasData () {
  let result = true

  console.log(`${logHeader} Checking for existing Assets`)
  // console.log(`${logHeader}:`, db.runCommand( { listCollections: 1 } ))

  const existingAssets = await Asset.find({}).exec()

  if (!existingAssets || existingAssets.length === 0) {
    console.log('No assets found.')
    result = false
  } else {
    console.log('Existing assets:', existingAssets)
  }

  return result
}
