const debug = require('debug')('liquality:agent:market')
const mongoose = require('mongoose')

const Bluebird = require('bluebird')
const BN = require('bignumber.js')
const { assets: ASSETS, chains, unitToCurrency } = require('@liquality/cryptoassets')

const Asset = require('./Asset')
const MarketHistory = require('./MarketHistory')

const fx = require('../utils/fx')
const { getClient } = require('../utils/clients')
const config = require('../config')
const coingecko = require('../utils/coinGeckoClient')
const reportError = require('../utils/reportError')

const MarketSchema = new mongoose.Schema(
  {
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
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      index: true
    }
  },
  { timestamps: true }
)

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
  const assetCodes = [
    ...markets.reduce((acc, market) => {
      acc.add(market.to)
      acc.add(market.from)

      return acc
    }, new Set())
  ]
  const assets = await Asset.find({ code: { $in: assetCodes } }).exec()
  const fixedUsdRates = assets.reduce((acc, asset) => {
    if (asset.fixedUsdRate) {
      acc[asset.code] = asset.fixedUsdRate
    }

    return acc
  }, {})
  const plainMarkets = markets.map((m) => ({ from: m.from, to: m.to }))
  debug(`Getting rates from coingecko `)
  const marketRates = await coingecko.getRates(plainMarkets, fixedUsdRates)
  debug(`Coingecko success next updating rates ...`)

  const LATEST_ASSET_MAP = {}
  await Bluebird.map(
    assets,
    async (asset) => {
      debug(`Updating ${asset.code}...`)
      const mkt = marketRates.find((market) => market.from === asset.code || market.to === asset.code)
      await MarketHistory.logRate([asset.code, 'USD'].join('-'), mkt.usd[asset.code])

      try {
        const client = await asset.getClient()
        const addresses = await client.wallet.getUsedAddresses()
        asset.balance = addresses.length === 0 ? 0 : await client.chain.getBalance(addresses)

        try {
          const address = (await client.wallet.getUnusedAddress()).address
          asset.address = chains[ASSETS[asset.code].chain].formatAddress(address)
        } catch (e) {
          // ignore if this snippet fails
        }

        debug('Balance', unitToCurrency(ASSETS[asset.code], asset.balance).toString(), asset.code)

        // force update timestamp, if balance doesn't change for an asset
        asset.updatedAt = new Date()
        await asset.save()

        debug('Updated', asset.code, asset.address)
      } catch (e) {
        reportError(e)
        debug(`Could not update balance of ${asset.code}`)
      }

      LATEST_ASSET_MAP[asset.code] = asset
    },
    { concurrency: 2 }
  )

  return Bluebird.map(
    markets,
    async (market) => {
      const { from, to } = market
      const fromAsset = LATEST_ASSET_MAP[from]
      const toAsset = LATEST_ASSET_MAP[to]

      const rate =
        config.assets[from].pegWith === to || config.assets[to].pegWith === from
          ? 1
          : marketRates.find((market) => market.from === from && market.to === to).rate
      const rateWithSpread = BN(rate).times(BN(1).minus(market.spread)).dp(8)
      const reverseMarketRate = BN(BN(1).div(rate)).times(BN(1).minus(market.spread)).dp(8)

      market.rate = rateWithSpread
      market.minConf = fromAsset.minConf
      market.min = fromAsset.min

      const toMaxAmount = BN(toAsset.balance).div(config.worker.minConcurrentSwaps)
      const toAssetMax = toAsset.max ? BN.min(toAsset.max, toMaxAmount) : toMaxAmount

      market.max = BN(fx.calculateToAmount(to, from, toAssetMax, reverseMarketRate)).dp(0, BN.ROUND_DOWN)

      await MarketHistory.logRate([market.from, market.to].join('-'), rateWithSpread)

      // force update timestamp, if rate doesn't change for a pair
      market.updatedAt = new Date()

      return market.save()
    },
    { concurrency: 3 }
  )
})

const Market = mongoose.model('Market', MarketSchema)
module.exports = Market
