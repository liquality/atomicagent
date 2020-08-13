const axios = require('axios')
const BN = require('bignumber.js')

class CoinGecko {
  constructor (url = 'https://api.coingecko.com/api/v3') {
    this._axios = axios.create({ baseURL: url })
  }

  async getCoins () {
    if (this._coins) return this._coins

    const { data } = await this._axios.get('/coins/markets?vs_currency=usd&order=market_cap_desc')
    this._coins = data

    return data
  }

  async getVsCurrencies () {
    if (this._vsCurrencies) return this._vsCurrencies

    const { data } = await this._axios.get('/simple/supported_vs_currencies')
    this._vsCurrencies = data

    return data
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

    return markets.map((market) => {
      let rate

      if (market.from in rates && market.to in rates[market.from]) {
        rate = BN(rates[market.from][market.to])
      } else {
        rate = BN(rates[market.from].usd).div(rates[market.to].usd)
      }

      return {
        from: market.from.toUpperCase(),
        to: market.to.toUpperCase(),
        rate,
        usd: {
          [market.from.toUpperCase()]: rates[market.from].usd,
          [market.to.toUpperCase()]: rates[market.to].usd
        }
      }
    })
  }
}

const coingecko = new CoinGecko()

module.exports = coingecko
