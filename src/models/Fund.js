const mongoose = require('mongoose')

const FundSchema = new mongoose.Schema({
  principal: {
    type: String,
    index: true
  },
  collateral: {
    type: String,
    index: true
  },
  lenderAddress: {
    type: String,
    index: true
  },
  minLoanAmount: {
    type: Number,
    index: true
  },
  maxLoanAmount: {
    type: Number,
    index: true
  },
  minLoanDuration: {
    type: Number,
    index: true
  },
  maxLoanDuration: {
    type: Number,
    index: true
  },
  fundExpiry: {
    type: Number,
    index: true
  },
  liquidationRatio: {
    type: Number,
    index: true
  },
  interest: {
    type: Number,
    index: true
  },
  penalty: {
    type: Number,
    index: true
  },
  fee: {
    type: Number
  },
  balance: {
    type: Number,
    index: true
  },
  cBalance: {
    type: Number,
    index: true
  },
  custom: {
    type: Boolean,
    index: true
  },
  compoundEnabled: {
    type: Boolean,
    index: true
  },
  confirmed: {
    type: Boolean,
    index: true
  },
  initiationHash: {
    type: String,
    index: true
  },
  amountToDepositOnCreate: {
    type: Number,
    index: true
  },
  fundId: {
    type: Number,
    index: true
  },
  status: {
    type: String,
    enum: ['INITIATED', 'CREATING', 'CREATED'],
    index: true
  }
})

FundSchema.methods.json = function () {
  const json = this.toJSON()
  json.id = json._id

  delete json._id
  delete json.__v

  return json
}

FundSchema.static('fromCustomFundParams', function (params) {
  return new Fund({
    principal: params.principal,
    collateral: params.collateral,
    custom: params.custom,
    maxLoanDuration: params.maxLoanDuration,
    fundExpiry: params.fundExpiry,
    compoundEnabled: params.compoundEnabled,
    liquidationRatio: params.liquidationRatio,
    interest: params.interest,
    penalty: params.penalty,
    fee: params.fee,
    amountToDepositOnCreate: params.amount,
    status: 'INITIATED'
  })
})

FundSchema.static('fromFundParams', function (params) {
  return new Fund({
    principal: params.principal,
    collateral: params.collateral,
    custom: params.custom,
    maxLoanDuration: params.maxLoanDuration,
    fundExpiry: params.fundExpiry,
    compoundEnabled: params.compoundEnabled,
    amountToDepositOnCreate: params.amount,
    status: 'INITIATED'
  })
})

// FundSchema.static('fromCustomFundParams', function (fundParams, fundId, initiationHash, principal, collateral) {
//   return new Fund({
//     minLoanAmount: fundParams[0],
//     maxLoanAmount: fundParams[1],
//     minLoanDuration: fundParams[2],
//     maxLoanDuration: fundParams[3],
//     maxFundDuration: fundParams[4],
//     liquidationRatio: fundParams[5],
//     interest: fundParams[6],
//     penalty: fundParams[7],
//     fee: fundParams[8],
//     compoundEnabled: fundParams[10],
//     custom: true,
//     confirmed: false,
//     initiationHash,
//     fundId,
//     principal,
//     collateral
//   })
// })

const Fund = mongoose.model('Fund', FundSchema)
module.exports = Fund
