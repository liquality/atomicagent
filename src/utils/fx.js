const BN = require('bignumber.js')

const MAP = {
  ETH: 1e18,
  BTC: 1e8
}

module.exports = (from, amountInLowestDenomination, to, rate) => ((BN(amountInLowestDenomination).div(MAP[from])).times(rate)).times(MAP[to])
