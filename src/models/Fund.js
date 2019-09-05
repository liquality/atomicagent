const mongoose = require('mongoose')

const clients = require('../utils/clients')

const FundSchema = new mongoose.Schema({
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
  maxFundDuration: {
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
  }
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
  }
})
