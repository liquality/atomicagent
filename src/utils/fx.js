const BN = require('bignumber.js')

const MAP = {
  ETH: 1e18,
  BTC: 1e8
}

module.exports = (from, amountInHighestDenomination, to, rate) => (BN(amountInHighestDenomination).times(rate)).times(MAP[to])
