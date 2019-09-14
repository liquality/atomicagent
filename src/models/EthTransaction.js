const mongoose = require('mongoose')
const BN = require('bignumber.js')
const { sha256 } = require('@liquality/crypto')

const clients = require('../utils/clients')
const { currencies } = require('../utils/fx')
const web3 = require('../utils/web3')
const { toWei } = web3.utils

const EthTransactionSchema = new mongoose.Schema({
  from: {
    type: String,
    index: true
  },
  to: {
    type: String,
    index: true
  },
  gas: {
    type: Number,
    index: true
  },
  gasPrice: {
    type: Number,
    index: true
  },
  data: {
    type: String
  },
  nonce: {
    type: Number,
    index: true
  },
  status: {
    type: String,
    enum: ['QUOTE', 'REQUESTING', 'AWAITING_COLLATERAL', 'APPROVING', 'APPROVED', 'CANCELLING', 'CANCELLED', 'ACCEPTING', 'ACCEPTED', 'AGENT_CLAIMED'],
    index: true
  }
})

EthTransactionSchema.methods.json = function () {
  const json = this.toJSON()
  json.id = json._id

  delete json._id
  delete json.__v

  return json
}

EthTransactionSchema.static('fromTxParams', function (params) {
  return new EthTransaction(params)
})

const EthTransaction = mongoose.model('EthTransaction', EthTransactionSchema)
module.exports = EthTransaction
