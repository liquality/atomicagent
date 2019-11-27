const config = require('../config')
require('mongoose').connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })

const Market = require('../models/Market')
const markets = require('./data/markets.json')

async function main () {
  await Market.deleteMany({})
  const newMarkets = await Market.insertMany(markets, { ordered: false })
  console.log(`${newMarkets.length} markets have been set`)
}

main()
