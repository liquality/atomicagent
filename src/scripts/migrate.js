const { assets, unitToCurrency } = require('@liquality/cryptoassets').default
const dateFns = require('date-fns')
const BN = require('bignumber.js')
const mongoose = require('mongoose')
const config = require('../config')

const mongooseOnError = err => {
  console.error(err)
  process.exit(1)
}

mongoose
  .connect(config.database.uri, {
    useNewUrlParser: true,
    useCreateIndex: true
  })
  .catch(mongooseOnError)

const Bluebird = require('bluebird')
const Order = require('../models/Order')
const MarketHistory = require('../models/MarketHistory')

async function main () {
  const orders = await Order.find({
    status: {
      $nin: ['QUOTE', 'QUOTE_EXPIRED']
    },
    createdAt: {
      $exists: true
    },
    migrationVersion: {
      $ne: 1
    }
  }).sort('-createdAt').exec()
  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const idx = ++index
    const log = (...message) => console.log(`[${idx}/${total}]\t[${order.from}-${order.to}]\t${order.orderId}\t`, ...message)

    const fromClient = order.fromClient()
    const toClient = order.toClient()

    order.fromRateUsd = BN(order.fromUsdValue).div(unitToCurrency(assets[order.from], order.fromAmount)).dp(2).toNumber()
    order.toRateUsd = BN(order.toUsdValue).div(unitToCurrency(assets[order.to], order.toAmount)).dp(2).toNumber()
    order.fromAmountUsd = order.fromUsdValue
    order.toAmountUsd = order.toUsdValue

    const fromType = assets[order.from].type
    const toType = assets[order.to].type
    let ethUsd = 0

    if (fromType === 'erc20' || toType === 'erc20') {
      ethUsd = await MarketHistory.getRateNear('ETH-USD', dateFns.getTime(order.createdAt))
    }

    if (fromType === 'erc20') {
      order.fromSecondaryRateUsd = ethUsd
    }

    if (toType === 'erc20') {
      order.toSecondaryRateUsd = ethUsd
    }

    if (order.fromFundHash) {
      try {
        const tx = await fromClient.chain.getTransactionByHash(order.fromFundHash)
        if (tx) {
          order.addTx('fromFundHash', tx)
          log('fromFundHash', tx.hash)

          try {
            const fromSecondaryFundTx = order.fromSecondaryFundHash
              ? await fromClient.chain.getTransactionByHash(order.fromSecondaryFundTx)
              : await order.findFromFundSwapTransaction()
            if (fromSecondaryFundTx) {
              order.addTx('fromSecondaryFundHash', fromSecondaryFundTx)
              log('fromSecondaryFundHash', fromSecondaryFundTx.hash)
            }
          } catch (e) {
            log('fromSecondaryFundHash', e.name, e.message)
          }
        }
      } catch (e) {
        log('fromFundHash', e.name, e.message)
      }
    }

    if (order.fromRefundHash) {
      try {
        const tx = await fromClient.chain.getTransactionByHash(order.fromRefundHash)
        if (tx) {
          order.addTx('fromRefundHash', tx)
          log('fromRefundHash', tx.hash)
        }
      } catch (e) {
        log('fromRefundHash', e.name, e.message)
      }
    }

    if (order.fromClaimHash) {
      try {
        const tx = await fromClient.chain.getTransactionByHash(order.fromClaimHash)
        if (tx) {
          order.addTx('fromClaimHash', tx)
          log('fromClaimHash', tx.hash)
        }
      } catch (e) {
        log('fromClaimHash', e.name, e.message)
      }
    }

    if (order.toFundHash) {
      try {
        const tx = await toClient.chain.getTransactionByHash(order.toFundHash)
        if (tx) {
          order.addTx('toFundHash', tx)
          log('toFundHash', tx.hash)

          try {
            const toSecondaryFundTx = order.toSecondaryFundHash
              ? await toClient.chain.getTransactionByHash(order.toSecondaryFundHash)
              : await order.findToFundSwapTransaction()
            if (toSecondaryFundTx) {
              order.addTx('toSecondaryFundHash', toSecondaryFundTx)
              log('toSecondaryFundHash', toSecondaryFundTx.hash)
            }
          } catch (e) {
            log('fromSecondaryFundHash', e.name, e.message)
          }
        }
      } catch (e) {
        log('toFundHash', e.name, e.message)
      }
    }

    if (order.toClaimHash) {
      try {
        const tx = await toClient.chain.getTransactionByHash(order.toClaimHash)
        if (tx) {
          order.addTx('toClaimHash', tx)
          log('toClaimHash', tx.hash)
        }
      } catch (e) {
        log('toClaimHash', e.name, e.message)
      }
    }

    if (order.toRefundHash) {
      try {
        const tx = await toClient.chain.getTransactionByHash(order.toRefundHash)
        if (tx) {
          order.addTx('toRefundHash', tx)
          log('toRefundHash', tx.hash)
        }
      } catch (e) {
        log('toRefundHash', e.name, e.message)
      }
    }

    order.migrationVersion = 1

    return order.save()
  }, { concurrency: 10 })

  console.log('Done')
  process.exit(0)
}

main()
