const mongoose = require('mongoose')

const clients = require('../utils/clients')

const OrderSchema = new mongoose.Schema({
  from: {
    type: String,
    index: true
  },
  to: {
    type: String,
    index: true
  },
  amount: {
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
  orderExpiresAt: {
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

  secretTxHash: {
    type: String,
    index: true
  },

  status: {
    type: String,
    enum: ['QUOTE', 'AGENT_PENDING', 'USER_FUNDED', 'AGENT_FUNDED', 'USER_CLAIMED', 'AGENT_CLAIMED'],
    index: true
  }
})

// OrderSchema.set('toJSON', { virtuals: true })

OrderSchema.methods.fromClient = function () {
  return clients[this.from]
}

OrderSchema.methods.toClient = function () {
  return clients[this.to]
}

OrderSchema.methods.json = function () {
  const json = this.toJSON()
  json.id = json._id

  delete json._id
  delete json.__v

  return json
}

OrderSchema.methods.setAgentAddresses = async function () {
  if (this.fromCounterPartyAddress) throw new Error('Address exists')

  const fromAddresses = await this.fromClient().wallet.getAddresses()
  const toAddresses = await this.toClient().wallet.getAddresses()

  this.fromCounterPartyAddress = fromAddresses[0].address
  this.toCounterPartyAddress = toAddresses[0].address
}

OrderSchema.static('fromMarket', function (market, amount) {
  return new Order({
    amount,
    from: market.from,
    to: market.to,
    rate: market.rate,
    minConf: market.minConf,

    orderExpiresAt: Date.now() + market.orderExpiresIn,
    status: 'QUOTE'
  })
})

const Order = mongoose.model('Order', OrderSchema)
module.exports = Order
