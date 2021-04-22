const { assets: cryptoassets, unitToCurrency, currencyToUnit } = require('@liquality/cryptoassets')

function calculateToAmount (from, to, fromAmount, rate) {
  const fromAmountBase = unitToCurrency(cryptoassets[from], fromAmount)
  const toBaseAmount = fromAmountBase.times(rate).toNumber()
  const toAmount = Math.floor(currencyToUnit(cryptoassets[to], toBaseAmount).toNumber())
  return toAmount
}

function calculateUsdAmount (asset, amount, usdRate) {
  return unitToCurrency(cryptoassets[asset], amount).times(usdRate).dp(2).toNumber()
}

function calculateFeeUsdAmount (asset, fee, usdRate) {
  return unitToCurrency(cryptoassets[asset], fee).times(usdRate).dp(2).toNumber()
}

module.exports = {
  calculateToAmount,
  calculateUsdAmount,
  calculateFeeUsdAmount
}
