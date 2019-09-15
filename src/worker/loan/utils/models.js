const LoanMarket = require('../../../models/LoanMarket')
const Market = require('../../../models/Market')

async function getMarketModels (principal, collateral) {
  const loanMarket = await LoanMarket.findOne({ principal, collateral }).exec()
  if (!loanMarket) return console.log('Error: Loan Market not found')

  const market = await Market.findOne({ from: collateral, to: principal }).exec()
  if (!market) return console.log('Error: Market not found')

  return { loanMarket, market }
}

module.exports = {
  getMarketModels
}
