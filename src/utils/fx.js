const cryptoassets = require('@liquality/cryptoassets').default

function calculateToAmount (from, to, fromAmount, rate) {
  const fromAmountBase = cryptoassets.unitToCurrency(cryptoassets.assets[from], fromAmount)
  const toBaseAmount = fromAmountBase.times(rate).toNumber()
  const toAmount = Math.floor(cryptoassets.currencyToUnit(cryptoassets.assets[to], toBaseAmount).toNumber())
  return toAmount
}

function calculateUsdAmount (asset, amount, usdRate) {
  return cryptoassets.unitToCurrency(cryptoassets.assets[asset], amount).times(usdRate).dp(2).toNumber()
}

function calculateFeeUsdAmount (asset, fee, usdRate) {
  return cryptoassets.unitToCurrency(cryptoassets.assets[asset], fee).times(usdRate).dp(2).toNumber()
}

module.exports = {
  calculateToAmount,
  calculateUsdAmount,
  calculateFeeUsdAmount
}
