const _ = require('lodash')
const axios = require('axios')
const BN = require('bignumber.js')

const config = require('../../config')

module.exports.pair = async (from, to) => {
  const apiKey = _.get(config, 'rateProvider.coinmarketcap.apiKey')
  if (!apiKey) throw new Error('Coinmarketcap requires rateProvider.coinmarketcap.apiKey')

  const { data } = await axios({
    url: `https://pro-api.coinmarketcap.com/v1/tools/price-conversion`,
    params: {
      amount: 1,
      symbol: from,
      convert: to
    },
    headers: {
      'X-CMC_PRO_API_KEY': apiKey
    }
  })

  return BN(data.data.quote[to].price).dp(8)
}
