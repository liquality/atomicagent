require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true })

const Bluebird = require('bluebird')
const Order = require('./src/models/Order')

async function main () {
  const orders = await Order.find({
    toFundHash: { $exists: true }
  }).sort('-createdAt').exec()

  console.log('Orders', orders.length)

  await Bluebird.map(orders, async (order, index) => {
    const toClient = order.toClient()

    try {
      const toFundTx = await toClient.chain.getTransactionByHash(order.toFundHash)
      if (!toFundTx) {
        console.log(index, order.orderId, 'Missing funding tx', order.toFundHash)
        return
      }
    } catch (e) {
      console.log(index, order.orderId, 'e', 'Missing funding tx', order.toFundHash)
      return
    }

    console.log(index, order.orderId, 'Good')

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 5 })

  console.log('Done')
}

main()
