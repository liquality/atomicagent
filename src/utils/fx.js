const cryptoassets = require('@liquality/cryptoassets').default

function calculateToAmount (from, to, fromAmount, rate) {
  const fromAmountBase = cryptoassets[from].unitToCurrency(fromAmount)
  const toBaseAmount = fromAmountBase.times(rate).toNumber()
  const toAmount = Math.floor(cryptoassets[to].currencyToUnit(toBaseAmount).toNumber())
  return toAmount
}

module.exports = { calculateToAmount }
