require('mongoose').connect('mongodb://localhost/liquality_testdata', { useNewUrlParser: true, useCreateIndex: true })

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const Bluebird = require('bluebird')
const cryptoassets = require('@liquality/cryptoassets').default
const BN = require('bignumber.js')
const { format } = require('date-fns')

const Order = require('./src/models/Order')

const ID_MAP = {
  DAI: 'dai',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDC: 'usd-coin',
  USDT: 'tether',
  WBTC: 'wrapped-bitcoin'
}

const getAssetDate = async (asset, date) => {
  const filePath = path.join(__dirname, 'marketdata', `${date}-${asset}-USD.json`)
  try {
    const t = require(filePath)
    console.log('------', asset, date)
    return t
  } catch (e) {}

  const id = ID_MAP[asset]

  if (Math.random() < 0.5) {
    await new Promise((resolve, reject) => setTimeout(resolve, 1000))
  }

  const { data } = await axios(`https://api.coingecko.com/api/v3/coins/${id}/history`, {
    params: {
      date,
      localization: false
    }
  })

  const { usd } = data.market_data.current_price

  fs.writeFileSync(filePath, usd)
  console.log('Logged', asset, date)

  return usd
}

async function fetchPrice () {
  const result = await Order.aggregate([
    {
      $match: {
        fromUsdValue: {
          $exists: false
        }
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $addFields: {
        date: { $dateToString: { format: '%d-%m-%Y', date: '$createdAt' } }
      }
    },
    {
      $group: {
        _id: '$date',
        all_from: { $addToSet: '$from' },
        all_to: { $addToSet: '$to' }
      }
    }
  ])

  await Bluebird.map(result, async item => {
    const assets = [...new Set([...item.all_from, ...item.all_to])]

    await Bluebird.map(assets, asset => getAssetDate(asset, item._id), { concurrency: 2 })
  }, { concurrency: 2 })

  console.log('Done')
}

async function main () {
  const orders = await Order.find({
    fromUsdValue: {
      $exists: false
    }
  }).lean().exec()

  await Bluebird.map(orders, async order => {
    const date = format(new Date(order.createdAt), 'dd-MM-yyyy')

    const fromUsd = await getAssetDate(order.from, date)
    const toUsd = await getAssetDate(order.to, date)

    const fromUsdValue = BN(cryptoassets[order.from.toLowerCase()].unitToCurrency(order.fromAmount)).times(fromUsd).dp(2).toNumber()
    const toUsdValue = BN(cryptoassets[order.to.toLowerCase()].unitToCurrency(order.toAmount)).times(toUsd).dp(2).toNumber()

    await Order.collection.updateOne({ _id: order._id }, {
      $set: {
        fromUsdValue,
        toUsdValue
      }
    })

    console.log(fromUsdValue, toUsdValue)
  }, { concurrency: 5 })

  console.log('Done')
}

// main()
fetchPrice()
