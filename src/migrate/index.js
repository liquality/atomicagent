const Market = require('../models/Market')
const markets = require('./data/markets.json')

const LoanMarket = require('../models/LoanMarket')
const loanMarkets = require('./data/loanMarkets.json')

async function main () {
  const newMarkets = await Market.insertMany(markets, { ordered: false })
  console.log(`${newMarkets.length} markets have been created`)

  const newLoanMarkets = await LoanMarket.insertMany(loanMarkets, { ordered: false })
  console.log(`${newLoanMarkets.length} loan markets have been created`)
}

main()
