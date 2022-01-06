const { assets, unitToCurrency, currencyToUnit } = require('@liquality/cryptoassets')

function calculateToAmount(from, to, fromAmount, rate) {
  const fromAmountBase = unitToCurrency(assets[from], fromAmount)
  const toBaseAmount = fromAmountBase.times(rate).toNumber()
  const toAmount = Math.floor(currencyToUnit(assets[to], toBaseAmount).toNumber())
  return toAmount
}

function calculateUsdAmount(asset, amount, usdRate) {
  return unitToCurrency(assets[asset], amount).times(usdRate).dp(2).toNumber()
}

function calculateFeeUsdAmount(asset, fee, usdRate) {
  return unitToCurrency(assets[asset], fee).times(usdRate).dp(2).toNumber()
}

module.exports = {
  calculateToAmount,
  calculateUsdAmount,
  calculateFeeUsdAmount
}
