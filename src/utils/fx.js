const BN = require('bignumber.js')

const currencies = {
  ETH: {
    baseUnit: 1e18
  },
  BTC: {
    baseUnit: 1e8
  },
  DAI: {
    baseUnit: 1e18
  },
  USDC: {
    baseUnit: 1e6
  }
}

function toBaseUnit (amountInHighestDenomination, to, rate) {
  return (BN(amountInHighestDenomination).times(rate)).times(currencies[to].baseUnit)
}

module.exports = {
  currencies,
  toBaseUnit
}
