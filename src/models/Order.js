const mongoose = require('mongoose')
const uuidv4 = require('uuid/v4')
const assets = require('@liquality/cryptoassets').default
const { getClient } = require('../utils/clients')
const crypto = require('../utils/crypto')
const { calculateToAmount } = require('../utils/fx')

const TEST_ENV = process.env.NODE_ENV === 'test'

const OrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    index: true,
    unique: true
  },
  from: {
    type: String,
    index: true
  },
  to: {
    type: String,
    index: true
  },
  fromAmount: {
    type: Number,
    index: true
  },
  toAmount: {
    type: Number,
    index: true
  },
  rate: {
    type: Number,
    index: true
  },
  minConf: {
    type: Number,
    index: true
  },
  expiresAt: {
    type: Number,
    index: true
  },
  fromCounterPartyAddress: {
    type: String,
    index: true
  },
  toCounterPartyAddress: {
    type: String,
    index: true
  },

  fromAddress: {
    type: String,
    index: true
  },
  toAddress: {
    type: String,
    index: true
  },

  fromFundHash: {
    type: String,
    index: true
  },
  toFundHash: {
    type: String,
    index: true
  },
  secretHash: {
    type: String,
    index: true
  },
  secret: {
    type: String,
    index: true
  },
  swapExpiration: {
    type: Number,
    index: true
  },
  nodeSwapExpiration: {
    type: Number,
    index: true
  },

  secretTxHash: {
    type: String,
    index: true
  },

  passphraseHash: {
    type: String
  },

  passphraseSalt: {
    type: String
  },

  status: {
    type: String,
    enum: ['QUOTE', 'USER_FUNDED_UNVERIFIED', 'USER_FUNDED', 'AGENT_FUNDED', 'USER_CLAIMED', 'AGENT_CLAIMED', 'AGENT_REFUNDED', 'QUOTE_EXPIRED', 'SWAP_EXPIRED'],
    index: true
  }
})

// OrderSchema.set('toJSON', { virtuals: true })

OrderSchema.methods.fromClient = function () {
  return getClient(this.from)
}

OrderSchema.methods.toClient = function () {
  return getClient(this.to)
}

OrderSchema.methods.json = function () {
  const json = this.toJSON()

  json.id = json.orderId
  delete json._id
  delete json.__v

  return json
}

OrderSchema.methods.setPassphrase = function (passphrase) {
  if (this.passphraseHash) throw new Error('Passphrase already exists')

  const {
    salt,
    hash
  } = crypto.hash(passphrase)

  this.passphraseSalt = salt
  this.passphraseHash = hash
}

OrderSchema.methods.verifyPassphrase = function (passphrase) {
  if (!this.passphraseHash) throw new Error('Passphrase doesn\'t exists')

  return crypto.verify(passphrase, this.passphraseSalt, this.passphraseHash)
}

OrderSchema.methods.setAgentAddresses = async function () {
  if (this.fromCounterPartyAddress) throw new Error('Address exists')

  const fromAddresses = await this.fromClient().wallet.getUnusedAddress()
  const toAddresses = await this.toClient().wallet.getUnusedAddress()

  this.fromCounterPartyAddress = assets[this.from.toLowerCase()].formatAddress(fromAddresses.address)
  this.toCounterPartyAddress = assets[this.to.toLowerCase()].formatAddress(toAddresses.address)
}

OrderSchema.methods.setExpiration = async function () {
  const buffer = TEST_ENV ? 60 : (60 * 60 * 6)
  const now = Math.ceil(Date.now() / 1000)

  this.swapExpiration = now + (buffer * 2)
  this.nodeSwapExpiration = now + buffer
}

OrderSchema.static('fromMarket', function (market, fromAmount) {
  return new Order({
    orderId: uuidv4(),
    fromAmount,
    toAmount: calculateToAmount(market.from, market.to, fromAmount, market.rate),
    from: market.from,
    to: market.to,
    rate: market.rate,
    minConf: market.minConf,

    expiresAt: Date.now() + market.orderExpiresIn,
    status: 'QUOTE'
  })
})

const Order = mongoose.model('Order', OrderSchema)
module.exports = Order
