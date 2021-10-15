const mongoose = require('mongoose')
const config = require('../config')
const BN = require('bignumber.js')

const mongooseOnError = err => {
  console.error(err)
  process.exit(1)
}

mongoose
  .connect(config.database.uri, {
    useNewUrlParser: true
  })
  .catch(mongooseOnError)

const Bluebird = require('bluebird')
const Order = require('../models/Order')

async function main () {
  const orders = await Order.find({
    status: {
      $ne: 'QUOTE'
    }
  }).sort('-createdAt').exec()

  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const log = message => console.log(`[${++index}/${total}] [${order.from}-${order.to}] ${order.orderId} - ${message}`)
    const toClient = await order.toClient()

    let toClaimTx

    if (!(
      order.toFundHash &&
      order.toAddress &&
      order.toCounterPartyAddress &&
      order.secretHash &&
      order.nodeSwapExpiration
    )) return

    try {
      const toClaimTx = await toClient.swap.findClaimSwapTransaction(
        {
          value: BN(order.toAmount),
          recipientAddress: order.toAddress,
          refundAddress: order.toCounterPartyAddress,
          secretHash: order.secretHash,
          expiration: order.nodeSwapExpiration
        },
        order.toFundHash
      )

      if (!toClaimTx) {
        log('Not claimed yet')
        return
      }
    } catch (e) {
      log('Not claimed yet')
      return
    }

    if (order.toClaimHash === toClaimTx.hash) {
      log('Verified')
      return
    }

    log(`Mismatch - On Record ${order.toClaimHash} vs On Chain ${toClaimTx.hash}`)

    order.toClaimHash = toClaimTx.hash
    await order.save()

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 10 })

  console.log('Done')
  process.exit(0)
}

main()
