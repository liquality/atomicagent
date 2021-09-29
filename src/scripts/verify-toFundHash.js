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
    toFundHash: { $exists: true }
  }).sort('-createdAt').exec()

  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const log = message => console.log(`[${++index}/${total}] [${order.from}-${order.to}] ${order.orderId} - ${message}`)
    const toClient = await order.toClient()

    try {
      const toFundTx = await toClient.chain.getTransactionByHash(order.toFundHash)

      if (!toFundTx) {
        log('Not funded yet')
        return
      }
    } catch (e) {
      log('Not funded yet')
      return
    }

    log('Verified')

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 5 })

  console.log('Done')
  process.exit(0)
}

main()
