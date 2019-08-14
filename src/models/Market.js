const mongoose = require('mongoose')

const clients = require('../utils/clients')

const MarketSchema = new mongoose.Schema({
  from: {
    type: String,
    index: true
  },
  to: {
    type: String,
    index: true
  },
  min: {
    type: Number
  },
  max: {
    type: Number
  },
  minConf: {
    type: Number
  },
  rate: {
    type: Number
  },
  orderExpiresIn: {
    type: Number
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    index: true
  }
})

MarketSchema.index({ from: 1, to: 1 }, { unique: true })

MarketSchema.methods.json = function () {
  const json = this.toJSON()

  delete json._id
  delete json.__v

  return json
}

MarketSchema.methods.fromClient = function () {
  return clients[this.from]
}

MarketSchema.methods.toClient = function () {
  return clients[this.to]
}

module.exports = mongoose.model('Market', MarketSchema)
