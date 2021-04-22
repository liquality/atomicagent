const _ = require('lodash')
const axios = require('axios')
const BN = require('bignumber.js')
const { assets: cryptoassets } = require('@liquality/cryptoassets')

class CoinGecko {
  constructor (url = 'https://api.coingecko.com/api/v3') {
    this._axios = axios.create({ baseURL: url })
  }

  async getVsCurrencies () {
    if (this._vsCurrencies) return this._vsCurrencies

    const { data } = await this._axios.get('/simple/supported_vs_currencies')
    this._vsCurrencies = data.map(c => c.toUpperCase()) // Normalize to agent casing

    return this._vsCurrencies
  }

  async getPrices (coinIds, vsCurrencies) {
    const formattedCoinIds = coinIds.join(',')
    const formattedVsCurrencies = vsCurrencies.map(c => c.toLowerCase()).join(',') // Normalize to agent casing
    const { data } = await this._axios.get(`/simple/price?ids=${formattedCoinIds}&vs_currencies=${formattedVsCurrencies}`)
    // Normalize to agent casing
    let formattedData = _.mapKeys(data, (v, coinGeckoId) => _.findKey(cryptoassets, asset => asset.coinGeckoId === coinGeckoId))
    formattedData = _.mapValues(formattedData, rates => _.mapKeys(rates, (v, k) => k.toUpperCase()))
    return formattedData
  }

  async getRates (markets) {
    const vsCurrencies = await this.getVsCurrencies()

    const vs = new Set(['USD'])
    const all = new Set([])
    markets.forEach((market) => {
      all.add(market.from)
      all.add(market.to)

      if (vsCurrencies.includes(market.from)) vs.add(market.from)
      if (vsCurrencies.includes(market.to)) vs.add(market.to)
    })

    const coinIds = [...all].map(currency => cryptoassets[currency].coinGeckoId)

    const rates = await this.getPrices(coinIds, [...vs])

    return markets.map((market) => {
      let rate

      if (market.from in rates && market.to in rates[market.from]) {
        rate = BN(rates[market.from][market.to])
      } else {
        rate = BN(rates[market.from].USD).div(rates[market.to].USD)
      }

      return {
        from: market.from,
        to: market.to,
        rate,
        usd: {
          [market.from]: rates[market.from].USD,
          [market.to]: rates[market.to].USD
        }
      }
    })
  }
}

const coingecko = new CoinGecko()

module.exports = coingecko
