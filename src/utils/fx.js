const cryptoassets = require('@liquality/cryptoassets').default

function calculateToAmount (from, to, fromAmount, rate) {
  const fromAmountBase = cryptoassets[from].unitToCurrency(fromAmount)
  const toBaseAmount = fromAmountBase.times(rate).toNumber()
  const toAmount = Math.floor(cryptoassets[to].currencyToUnit(toBaseAmount).toNumber())
  return toAmount
}

function calculateUsdAmount (asset, amount, usdRate) {
  return cryptoassets[asset].unitToCurrency(amount).times(usdRate).dp(2).toNumber()
}

function calculateFeeUsdAmount (asset, fee, usdRate) {
  return cryptoassets[asset].unitToCurrency(fee).times(usdRate).dp(2).toNumber()
}

module.exports = {
  calculateToAmount,
  calculateUsdAmount,
  calculateFeeUsdAmount
}
