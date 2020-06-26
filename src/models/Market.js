const debug = require('debug')('liquality:agent:model:market')
const mongoose = require('mongoose')

const Bluebird = require('bluebird')
const axios = require('axios')
const BN = require('bignumber.js')

const Asset = require('./Asset')
const fx = require('../utils/fx')
const { getClient } = require('../utils/clients')
const config = require('../config')
const coingecko = require('../utils/coinGeckoClient')

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
  const plainMarkets = markets.map(m => ({ from: m.from, to: m.to }))
  const marketRates = await coingecko.getRates(plainMarkets)

  const ASSET_MAP = {}
  await Bluebird.map(assets, async asset => {
    const client = asset.getClient()

    const addresses = await client.wallet.getUsedAddresses()
    asset.actualBalance = await client.chain.getBalance(addresses)

    ASSET_MAP[asset.code] = asset

    debug('balance', asset.code, asset.actualBalance)

    return asset.save()
  }, { concurrency: 3 })

  return Bluebird.map(markets, market => {
    const { from, to } = market

    const rate = marketRates.find(market => market.from === from && market.to === to).rate
    const rateWithSpread = rate.times(BN(1).minus(market.spread)).dp(8)
    const reverseMarket = markets.find(market => market.to === from && market.from === to) || { rate: BN(1).div(rateWithSpread) }
    const fromAsset = ASSET_MAP[from]
    const toAsset = ASSET_MAP[to]

    market.rate = rateWithSpread
    market.minConf = fromAsset.minConf
    market.min = fromAsset.min

    const toMaxAmount = BN(toAsset.actualBalance).div(config.worker.minConcurrentSwaps)
    const toAssetMax = toAsset.max
      ? BN.min(toAsset.max, toMaxAmount)
      : toMaxAmount

    market.max = BN(fx.calculateToAmount(to, from, toAssetMax, reverseMarket.rate)).dp(0, BN.ROUND_DOWN)

    debug(`${market.from}_${market.to}`, market.rate, `[${market.min}, ${market.max}]`)

    return market.save()
  }, { concurrency: 3 })
})

const Market = mongoose.model('Market', MarketSchema)
module.exports = Market
