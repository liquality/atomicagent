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
  conditions: {
    type: Array
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    index: true
  }
})

MarketSchema.set('toJSON', { virtuals: true })
MarketSchema.index({ from: 1, to: 1 }, { unique: true })

MarketSchema.virtual('lastOffer').get(function () {
  return this.conditions[this.conditions.length - 1]
})

MarketSchema.virtual('max').get(function () {
  return this.lastOffer.max
})

MarketSchema.virtual('conf').get(function () {
  return this.lastOffer.conf
})

MarketSchema.virtual('rate').get(function () {
  return this.lastOffer.rate
})

MarketSchema.virtual('orderExpiresIn').get(function () {
  return this.conditions[this.conditions.length - 1].orderExpiresIn
})

MarketSchema.methods.fromClient = function () {
  return clients[this.from]
}

MarketSchema.methods.toClient = function () {
  return clients[this.to]
}

MarketSchema.methods.findConditionForAmount = function (amount) {
  return this.conditions.find(condition => amount <= condition.max)
}

module.exports = mongoose.model('Market', MarketSchema)
