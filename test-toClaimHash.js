require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })

const Bluebird = require('bluebird')
const Order = require('./src/models/Order')

function log (index, order, ...messages) {
  console.log(`${order.orderId}:${order.from}-${order.to}`, ...messages, `(${index})`)
}

async function main () {
  const orders = await Order.find({
    // status: 'AGENT_FUNDED',
    status: {
      $ne: 'QUOTE'
    },
    updatedAt: {
      $lt: new Date(Date.now() - (1000 * 60 * 60 * 24))
    }
  }).sort('-createdAt').exec()

  console.log('Orders', orders.length)

  await Bluebird.map(orders, async (order, index) => {
    const toClient = order.toClient()

    let toClaimHash

    if (!(
      order.toFundHash &&
      order.toAddress &&
      order.toCounterPartyAddress &&
      order.secretHash &&
      order.nodeSwapExpiration
    )) return

    try {
      const toClaimTx = await toClient.swap.findClaimSwapTransaction(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration
      )

      if (!toClaimTx) {
        log(index, order, 'Not claimed yet!')
        return
      }

      toClaimHash = toClaimTx.hash
    } catch (e) {
      log(index, order, 'e', 'Not claimed yet!')
      return
    }

    if (order.toClaimHash) {
      if (order.toClaimHash === toClaimHash) {
        log(index, order, 'Good')
      } else {
        log(index, order, 'Mismatch', order.toClaimHash, toClaimHash)
      }

      return
    }

    order.toClaimHash = toClaimHash
    await order.save()
    log(index, order, 'Updated', toClaimHash)

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 10 })

  console.log('Done')
}

main()
