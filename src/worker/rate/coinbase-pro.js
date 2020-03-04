const axios = require('axios')
const Bluebird = require('bluebird')
const BN = require('bignumber.js')

module.exports.pair = async (from, to) => {
  const { data } = await axios(`https://api.pro.coinbase.com/products/${from}-${to}/ticker`)

  return BN(data.price)
}

module.exports.convert = async (from, to, base) => {
  const MAP = {}

  await Bluebird.map([from, to], async currency => {
    const { data } = await axios(`https://api.coinbase.com/v2/prices/${currency}-${base}/spot`)

    MAP[currency] = BN(data.data.amount)
  }, { concurrency: 1 })

  return MAP[from].div(MAP[to])
}
