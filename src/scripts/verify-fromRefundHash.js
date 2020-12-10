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
    status: {
      $in: ['AGENT_REFUNDED', 'AGENT_FUNDED']
    }
  }).sort('-createdAt').exec()

  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const log = message => console.log(`[${++index}/${total}] [${order.from}-${order.to}] ${order.orderId} - ${message}`)
    const fromClient = order.fromClient()

    let fromRefundTx

    try {
      fromRefundTx = await fromClient.swap.findRefundSwapTransaction(
        order.fromFundHash,
        order.fromCounterPartyAddress,
        order.fromAddress,
        order.secretHash,
        order.swapExpiration
      )

      if (!fromRefundTx) {
        log('Not refunded yet')
        return
      }
    } catch (e) {
      log('Not refunded yet')
      return
    }

    if (order.fromRefundHash === fromRefundTx.hash) {
      log('Verified')
      return
    }

    log(`Mismatch - On Record ${order.fromRefundHash} vs On Chain ${fromRefundTx.hash}`)

    order.addTx('fromRefundHash', fromRefundTx)
    await order.save()

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 10 })

  console.log('Done')
  process.exit(0)
}

main()
