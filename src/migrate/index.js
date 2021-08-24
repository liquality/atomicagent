const objectUtils = require('lodash/object')
const Asset = require('../models/Asset')
const Market = require('../models/Market')
const assets = require('./data/assets.json')
const markets = require('./data/markets.json')

const defaultLog = true
const defaultVerbose = false
const defaultForce = false
const logHeader = '[MIGRATE]'

module.exports.run = async (options = {}) => {
  console.log(`${logHeader} Running migrate with options:`, options)
  const log = objectUtils.get(options, 'log', defaultLog)
  const verbose = objectUtils.get(options, 'verbose', defaultVerbose)
  const force = objectUtils.get(options, 'force', defaultForce)

  const keepAlive = process.env.KEEP_ALIVE || false
  console.log(`${logHeader} keep alive?`, keepAlive)

  if (!force && await hasData({ verbose })) {
    if (log) console.log(`${logHeader} Data is already seeded.`)
  } else {
    if (log) console.log(`${logHeader} Seeding data...`)
    await Asset.deleteMany({})
    const newAssets = await Asset.insertMany(assets, { ordered: false })
    if (log) console.log(`${logHeader} ${newAssets.length} assets have been set`)

    await Market.deleteMany({})
    const newMarkets = await Market.insertMany(markets, { ordered: false })
    if (log) console.log(`${logHeader} ${newMarkets.length} markets have been set`)
  }

  if (!keepAlive) process.exit()
}

async function hasData (options = {}) {
  const verbose = options.verbose
  let result = true

  if (verbose) console.log(`${logHeader} Checking for existing assets`)

  const existingAssets = await Asset.find({}).exec()

  if (!existingAssets || existingAssets.length === 0) {
    if (verbose) console.log('No assets found.')
    result = false
  } else {
    if (verbose) console.log('Existing assets:', existingAssets)
  }

  return result
}
