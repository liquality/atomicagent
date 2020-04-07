const mongoose = require('mongoose')

const { getClient } = require('../utils/clients')

const AssetSchema = new mongoose.Schema({
  code: {
    type: String,
    index: true
  },

  actualBalance: {
    type: Number
  },

  min: {
    type: Number
  },

  max: {
    type: Number
  },

  minConf: {
    type: Number
  }
}, { timestamps: true })

AssetSchema.methods.getClient = function () {
  return getClient(this.code)
}

AssetSchema.methods.json = function () {
  const json = this.toJSON()

  delete json._id
  delete json.__v

  return json
}

module.exports = mongoose.model('Asset', AssetSchema)
