const Market = require('../models/Market')
const markets = require('./data/markets.json')

async function main () {
  const newMarkets = await Market.insertMany(markets, { ordered: false })
  console.log(`${newMarkets.length} markets have been created`)
}

main()
