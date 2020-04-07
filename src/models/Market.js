const debug = require('debug')('liquality:agent:model:market')
const mongoose = require('mongoose')

const Bluebird = require('bluebird')
const axios = require('axios')
const BN = require('bignumber.js')

const Asset = require('./Asset')
const fx = require('../utils/fx')
const { getClient } = require('../utils/clients')
const config = require('../config')

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
  spread: {
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
}, { timestamps: true })

MarketSchema.index({ from: 1, to: 1 }, { unique: true })

MarketSchema.methods.json = function () {
  const json = this.toJSON()

  delete json._id
  delete json.__v

  return json
}

MarketSchema.methods.fromClient = function () {
  return getClient(this.from)
}

MarketSchema.methods.toClient = function () {
  return getClient(this.to)
}

MarketSchema.static('updateAllMarketData', async function () {
  const markets = await Market.find({ status: 'ACTIVE' }).exec()
  const assetCodes = [...markets.reduce((acc, market) => {
    acc.add(market.to)
    acc.add(market.from)

    return acc
  }, new Set())]
  const assets = await Asset.find({ code: { $in: assetCodes } }).exec()

  const ASSET_MAP = {}
  const ASSET_USD = {}
  await Bluebird.map(assets, async asset => {
    const client = asset.getClient()

    const [{ data }, addresses] = await Promise.all([
      axios(`https://api.coinbase.com/v2/prices/${asset.code}-USD/spot`),
      client.wallet.getUsedAddresses()
    ])

    ASSET_MAP[asset.code] = asset
    ASSET_USD[asset.code] = data.data.amount

    asset.actualBalance = await client.chain.getBalance(addresses)

    debug('balance', asset.code, asset.actualBalance)

    return asset.save()
  }, { concurrency: 3 })

  return Bluebird.map(markets, market => {
    const { from, to } = market

    const rate = BN(ASSET_USD[from]).div(ASSET_USD[to]).times(BN(1).minus(market.spread)).dp(8)
    const reverseMarket = markets.find(market => market.to === from && market.from === to) || { rate: BN(1).div(rate) }
    const fromAsset = ASSET_MAP[from]
    const toAsset = ASSET_MAP[to]

    market.rate = rate
    market.minConf = fromAsset.minConf
    market.min = fromAsset.min
    market.max = BN.min(
      fx.calculateToAmount(to, from, toAsset.max, reverseMarket.rate),
      fromAsset.max,
      BN(fromAsset.actualBalance).div(config.worker.minConcurrentSwaps)
    ).dp(8)

    debug(`${market.from}_${market.to}`, market.rate, `[${market.min}, ${market.max}]`)

    return market.save()
  }, { concurrency: 3 })
})

const Market = mongoose.model('Market', MarketSchema)
module.exports = Market
