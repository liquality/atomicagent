const BN = require('bignumber.js')
const cryptoassets = require('@liquality/cryptoassets').default

function calculateToAmount (from, to, fromAmount, rate) {
  const fromAmountBase = cryptoassets[from.toLowerCase()].unitToCurrency(fromAmount)
  const toBaseAmount = fromAmountBase.times(rate).toNumber()
  const toAmount = Math.floor(cryptoassets[to.toLowerCase()].currencyToUnit(toBaseAmount).toNumber())
  return toAmount
}

module.exports = { calculateToAmount }
