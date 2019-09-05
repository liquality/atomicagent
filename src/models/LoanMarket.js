const mongoose = require('mongoose')

const clients = require('../utils/clients')

const LoanMarketSchema = new mongoose.Schema({
  principal: {
    type: String,
    index: true
  },
  collateral: {
    type: String,
    index: true
  },
  chain: {
    type: String,
    index: true
  },
  minPrincipal: {
    type: Number
  },
  maxPrincipal: {
    type: Number
  },
  minCollateral: {
    type: Number
  },
  maxCollateral: {
    type: Number
  },

  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    index: true
  }
})

LoanMarketSchema.index({ principal: 1, collateral: 1 }, { unique: true })

LoanMarketSchema.methods.json = function () {
  const json = this.toJSON()
  json.id = json._id

  delete json._id
  delete json.__v

  return json
}

LoanMarketSchema.methods.principalClient = function () {
  return clients[this.chain]
}

LoanMarketSchema.methods.collateralClient = function () {
  return clients[this.collateral]
}

LoanMarketSchema.methods.getAgentAddresses = async function () {
  const principalAddresses = await this.principalClient().wallet.getAddresses()
  const collateralAddresses = await this.collateralClient().wallet.getAddresses()

  console.log('principalAddresses', principalAddresses)
  console.log('collateralAddresses', collateralAddresses)

  return { principalAddress: principalAddresses[0].address, collateralAddress: collateralAddresses[0].address }
}

module.exports = mongoose.model('LoanMarket', LoanMarketSchema)
