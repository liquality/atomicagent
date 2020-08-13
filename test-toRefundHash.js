require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })

const Bluebird = require('bluebird')
const Order = require('./src/models/Order')

function log (index, order, ...messages) {
  console.log(`${order.orderId}:${order.from}-${order.to}`, ...messages, `(${index})`)
}

async function main () {
  const orders = await Order.find({
    status: 'AGENT_REFUNDED'
    // updatedAt: {
    //   $lt: new Date(Date.now() - (1000 * 60 * 60 * 24))
    // }
  }).sort('-createdAt').exec()

  console.log('Orders', orders.length)

  await Bluebird.map(orders, async (order, index) => {
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
        log(index, order, 'Not refunded yet!')
        return
      }

      toRefundHash = toRefundTx.hash
    } catch (e) {
      log(index, order, 'e', 'Not refunded yet!')
      return
    }

    if (order.toRefundHash) {
      if (order.toRefundHash === toRefundHash) {
        log(index, order, 'Good')
      } else {
        log(index, order, 'Mismatch', order.toRefundHash, toRefundHash)
      }

      return
    }

    order.toRefundHash = toRefundHash
    await order.save()
    log(index, order, 'Updated', toRefundHash)

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 10 })

  console.log('Done')
}

main()
