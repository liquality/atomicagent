const Decimal = require('decimal.js')

Decimal.set({ precision: 28, rounding: 8 })

function rateToSec (apr) { // Convert interest rate to rate per second (i.e. 16.5%)
  const decRate = Decimal(apr).dividedBy(100).plus(1)
  return Decimal(10).toPower(Decimal.log(decRate).dividedBy(60 * 60 * 24 * 365)).toString()
}

module.exports = {
  rateToSec
}
