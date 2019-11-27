const axios = require('axios')
const BN = require('bignumber.js')
const Market = require('../../models/Market')
const debug = require('debug')('liquality:agent:worker')

module.exports = agenda => async (job) => {
  debug('Updating market data')

  const markets = await Market.find({ status: 'ACTIVE' }).exec()
  const currencies = Array.from(new Set([].concat(...markets.map(market => [market.from, market.to]))))
  const MAP = {}

  await Promise.all(currencies.map(currency => {
    return axios(`https://api.coinbase.com/v2/prices/${currency}-USD/spot`)
      .then(res => {
        MAP[currency] = res.data.data.amount
      })
  }))

  await Promise.all(markets.map(market => {
    const from = BN(MAP[market.from])
    const to = BN(MAP[market.to])

    let rate = from.div(to) // Market rate
    rate = rate.times(BN(1).minus(BN(market.spread))) // Remove spread
    rate = rate.dp(8)

    market.rate = rate

    debug(`${market.from}_${market.to}`, market.rate)

    return market.save()
  }))
}
