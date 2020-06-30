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
    this._axios = axios.create({ baseURL: url, adapter: cache.adapter })
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
      // Match coingecko casing
      market.from = market.from.toLowerCase()
      market.to = market.to.toLowerCase()

      all.add(market.from)
      all.add(market.to)
      if (vsCurrencies.includes(market.from)) vs.add(market.from)
      if (vsCurrencies.includes(market.to)) vs.add(market.to)
    })

    const coindIds = [...all].map(currency => {
      return coins.find(coin => coin.symbol === currency).id
    })

    const response = await this._axios.get(`/simple/price?ids=${coindIds.join(',')}&vs_currencies=${[...vs].join(',')}`)

    const rates = Object.entries(response.data).reduce((curr, [id, toPrices]) => {
      const currencyCode = coins.find(coin => coin.id === id).symbol
      return Object.assign(curr, { [currencyCode]: toPrices })
    }, {})

    const marketRates = markets.map((market) => {
      let rate
      if (market.from in rates && market.to in rates[market.from]) {
        rate = BN(rates[market.from][market.to])
      } else {
        rate = BN(rates[market.from].usd).div(rates[market.to].usd)
      }
      return {
        from: market.from.toUpperCase(),
        to: market.to.toUpperCase(),
        rate
      }
    })

    return marketRates
  }
}

const coingecko = new CoinGecko()

module.exports = coingecko
