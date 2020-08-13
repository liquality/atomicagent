require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })

const Bluebird = require('bluebird')
const Order = require('./src/models/Order')

function log (index, order, ...messages) {
  console.log(`${order.orderId}:${order.from}-${order.to}`, ...messages, `(${index})`)
}

async function main () {
  const orders = await Order.find({
    status: {
      $in: ['AGENT_REFUNDED', 'AGENT_FUNDED']
    }
    // updatedAt: {
    //   $lt: new Date(Date.now() - (1000 * 60 * 60 * 24))
    // }
  }).sort('-createdAt').exec()

  console.log('Orders', orders.length)

  await Bluebird.map(orders, async (order, index) => {
    const fromClient = order.fromClient()

    let fromRefundHash

    try {
      const fromRefundTx = await fromClient.swap.findRefundSwapTransaction(
        order.fromFundHash,
        order.fromCounterPartyAddress,
        order.fromAddress,
        order.secretHash,
        order.swapExpiration
      )

      if (!fromRefundTx) {
        log(index, order, 'Not refunded yet!')
        return
      }

      fromRefundHash = fromRefundTx.hash
    } catch (e) {
      log(index, order, 'e', 'Not refunded yet!')
      return
    }

    if (order.fromRefundHash) {
      if (order.fromRefundHash === fromRefundHash) {
        log(index, order, 'Good')
      } else {
        log(index, order, 'Mismatch', order.fromRefundHash, fromRefundHash)
      }

      return
    }

    // order.fromRefundHash = fromRefundHash
    // await order.save()
    log(index, order, 'Updated', fromRefundHash)

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 10 })

  console.log('Done')
}

main()
