const toSecs = require('@mblackmblack/to-seconds')

function customFundWithFundExpiryIn100Days (currentTime, principal) {
  return {
    collateral: 'BTC',
    principal,
    custom: true,
    compoundEnabled: false,
    amount: 0,
    maxLoanDuration: 0,
    fundExpiry: currentTime + toSecs({ days: 100 }),
    liquidationRatio: 150, // 150% collateralization ratio
    interest: 16.5, // 16.5% APR
    penalty: 3, // 3% APR
    fee: 0.75 // 0.75% APR
  }
}

const fundFixtures = {
  customFundWithFundExpiryIn100Days
}

module.exports = fundFixtures
