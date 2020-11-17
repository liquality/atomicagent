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

async function main () {
  const orders = await Order.find({
    status: 'AGENT_REFUNDED'
  }).sort('-createdAt').exec()

  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const log = message => console.log(`[${++index}/${total}] [${order.from}-${order.to}] ${order.orderId} - ${message}`)
    const toClient = order.toClient()

    let toRefundHash

    try {
      const toRefundTx = await toClient.swap.findRefundSwapTransaction(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration
      )

      if (!toRefundTx) {
        log('Not refunded yet')
        return
      }

      toRefundHash = toRefundTx.hash
    } catch (e) {
      log('Not refunded yet')
      return
    }

    if (order.toRefundHash === toRefundHash) {
      log('Verified')
      return
    }

    log(`Mismatch - On Record ${order.toRefundHash} vs On Chain ${toRefundHash}`)

    order.toRefundHash = toRefundHash
    await order.save()

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 10 })

  console.log('Done')
  process.exit(0)
}

main()
