const BN = require('bignumber.js')
const cryptoassets = require('@liquality/cryptoassets').default

function calculateToAmount (from, to, fromAmount, rate) {
  const fromAmountBase = cryptoassets[from.toLowerCase()].unitToCurrency(fromAmount)
  const toBaseAmount = BN(fromAmountBase).times(rate).toNumber()
  return cryptoassets[to.toLowerCase()].currencyToUnit(toBaseAmount)
}

module.exports = { calculateToAmount }
