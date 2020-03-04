const Sentry = require('@sentry/node')
const Bluebird = require('bluebird')
const BN = require('bignumber.js')
const debug = require('debug')('liquality:agent:worker')

const Market = require('../../models/Market')
const config = require('../../config')
const rateProviders = require('../rate')

module.exports = agenda => async job => {
  debug('Updating market data')

  const markets = await Market.find({ status: 'ACTIVE' }).exec()

  await Bluebird.map(markets, async market => {
    const pair = `${market.from}-${market.to}`

    try {
      const pairConfig = config.rate.pairs[pair]
      const { provider, type, base, flip } = pairConfig
      let { from, to } = market

      if (flip) {
        from = market.to
        to = market.from
      }

      const providerFn = rateProviders[provider][type]

      let rate = await providerFn(from, to, base)

      if (flip) {
        rate = BN(1).div(rate)
      }

      market.rate = BN(rate).times(BN(1).minus(BN(market.spread))).dp(8).toNumber()

      debug(pair, market.rate)

      return market.save()
    } catch (e) {
      Sentry.withScope(scope => {
        scope.setTag('pair', pair)
        Sentry.captureException(e)
      })

      debug(e)
    }
  }, { concurrency: 1 })
}
