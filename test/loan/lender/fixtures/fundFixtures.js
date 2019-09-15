const toSecs = require('@mblackmblack/to-seconds')

function customDAIFundWithFundExpiryIn100Days (currentTime) {
  return {
    collateral: 'BTC',
    principal: 'DAI',
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
  customDAIFundWithFundExpiryIn100Days
}

module.exports = fundFixtures
