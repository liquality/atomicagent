require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true })

const Bluebird = require('bluebird')
const Order = require('./src/models/Order')

async function main () {
  const orders = await Order.find({
    status: 'AGENT_CLAIMED'
    // updatedAt: {
    //   $lt: new Date(Date.now() - (1000 * 60 * 60 * 24))
    // }
  }).sort('-createdAt').exec()

  console.log('Orders', orders.length)

  await Bluebird.map(orders, async (order, index) => {
    const fromClient = order.fromClient()

    const fromClaimTx = await fromClient.swap.findClaimSwapTransaction(
      order.fromFundHash,
      order.fromCounterPartyAddress,
      order.fromAddress,
      order.secretHash,
      order.swapExpiration
    )

    if (!fromClaimTx) {
      console.log(order.orderId, 'Not claimed yet!')
      return
    }

    const fromClaimHash = fromClaimTx.hash

    if (order.fromClaimHash) {
      if (order.fromClaimHash === fromClaimHash) {
        console.log(index, order.orderId, 'Good')
      } else {
        console.log(index, order.orderId, 'Mismatch', order.fromClaimHash, fromClaimHash)
      }

      return
    }

    order.fromClaimHash = fromClaimHash
    await order.save()
    console.log(index, order.orderId, 'Updated', fromClaimHash)

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 1 })

  console.log('Done')
}

main()
