const BN = require('bignumber.js')

const currencies = {
  ETH: {
    multiplier: 1e18,
    unit: 'ether',
    decimals: 18
  },
  BTC: {
    multiplier: 1e8,
    decimals: 8
  },
  DAI: {
    multiplier: 1e18,
    unit: 'ether',
    chain: 'ETH',
    decimals: 18
  },
  USDC: {
    multiplier: 1e6,
    unit: 'mwei',
    chain: 'ETH',
    decimals: 6
  }
}

function toBaseUnit (amountInHighestDenomination, to, rate) {
  return (BN(amountInHighestDenomination).times(rate)).times(currencies[to].multiplier)
}

module.exports = {
  currencies,
  toBaseUnit
}
