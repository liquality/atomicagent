const axios = require('axios')
const { setupCache } = require('axios-cache-adapter')
const BN = require('bignumber.js')

// Cache only applies to reqs without query params
const cache = setupCache({
  maxAge: 4 * 60 * 60 * 1000, // 4h
  exclude: { query: true }
})

class CoinGecko {
  constructor (url = 'https://api.coingecko.com/api/v3') {
    this._url = url
    this._axios = axios.create({ baseURL: this._url, adapter: cache.adapter })
    this._axios.interceptors.response.use(function (response) {
      return response
    }, function (e) {
      let error = ''
      if (e.response && e.response.data && e.response.data.error) error = '. ' + e.response.data.error
      throw new Error(`CoinGecko: ${e.message}${error}`)
    })
    this._cache = {} // TODO: axios cache adapeter?
  }

  async getCoins () {
    const response = await this._axios.get('/coins/list')
    return response.data
  }

  async getVsCurrencies () {
    const response = await this._axios.get('/simple/supported_vs_currencies')
    return response.data
  }

  async getRates (markets) {
    const [coins, vsCurrencies] = await Promise.all([this.getCoins(), this.getVsCurrencies()])

    const vs = new Set(['usd'])
    const all = new Set([])
    markets.forEach((market) => {
      all.add(market.from)
      all.add(market.to)
      if (vsCurrencies.includes(market.from)) vs.add(market.from)
      if (vsCurrencies.includes(market.to)) vs.add(market.to)
    })

    const coindIds = [...all].map(currency => {
      return coins.find(coin => coin.symbol === currency.toLowerCase()).id
    })

    const response = await this._axios.get(`/simple/price?ids=${coindIds.join(',')}&vs_currencies=${[...vs].join(',')}`)

    const rates = Object.entries(response.data).reduce((curr, [id, toPrices]) => {
      const currencyCode = coins.find(coin => coin.id === id).symbol
      return Object.assign(curr, { [currencyCode.toUpperCase()]: toPrices })
    }, {})

    const marketRates = markets.map((market) => {
      let rate
      if (market.from in rates && market.to in rates[market.from]) {
        rate = BN(rates[market.from][market.to])
      } else {
        rate = BN(rates[market.from].usd).div(rates[market.to].usd)
      }
      return { ...market, rate }
    })

    return marketRates
  }
}

const coingecko = new CoinGecko()

module.exports = coingecko
