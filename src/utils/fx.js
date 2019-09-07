const BN = require('bignumber.js')

const currencies = {
  ETH: {
    multiplier: 1e18,
    unit: 'ether'
  },
  BTC: {
    multiplier: 1e8
  },
  DAI: {
    multiplier: 1e18,
    unit: 'ether'
  },
  USDC: {
    multiplier: 1e6,
    unit: 'mwei'
  }
}

function toBaseUnit (amountInHighestDenomination, to, rate) {
  return (BN(amountInHighestDenomination).times(rate)).times(currencies[to].multiplier)
}

module.exports = {
  currencies,
  toBaseUnit
}
