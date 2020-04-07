const debug = require('debug')('liquality:agent:worker:update-market-data')

const Bluebird = require('bluebird')
const axios = require('axios')
const BN = require('bignumber.js')

const Asset = require('../../models/Asset')
const Market = require('../../models/Market')

const fx = require('../../utils/fx')

module.exports = agenda => async job => {
  debug('Updating market data')

  const markets = await Market.find({ status: 'ACTIVE' }).exec()
  const assetCodes = Market.getAssetsFromMarkets(markets)
  const assets = await Asset.find({ code: { $in: assetCodes } }).exec()

  const ASSET_MAP = {}
  const ASSET_USD = {}
  await Promise.all(assets.map(asset => {
    return axios(`https://api.coinbase.com/v2/prices/${asset.code}-USD/spot`)
      .then(res => {
        ASSET_MAP[asset.code] = asset
        ASSET_USD[asset.code] = res.data.data.amount
      })
  }))

  await Bluebird.map(markets, market => {
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
      fromAsset.max
    )

    debug(`${market.from}_${market.to}`, market.rate, `[${market.min}, ${market.max}]`)

    return market.save()
  }, { concurrency: 3 })
}
