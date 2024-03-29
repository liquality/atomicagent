const mongoose = require('mongoose')

const { getClient } = require('../utils/clients')

const AssetSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true
    },

    address: {
      type: String,
      index: true
    },

    balance: {
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
    },

    fixedUsdRate: {
      type: Number
    },

    '24hrUsdLimit': {
      type: Number
    }
  },
  { timestamps: true }
)

AssetSchema.methods.getClient = function () {
  return getClient(this.code)
}

AssetSchema.methods.json = function () {
  const json = this.toJSON()

  delete json._id
  delete json.__v

  return json
}

const Asset = mongoose.model('Asset', AssetSchema)
module.exports = Asset
