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
    status: { $ne: 'QUOTE' },
    txMap: { $exists: true }
  }).exec()

  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const log = message => console.log(`[${++index}/${total}] [${order.from}-${order.to}] ${order.orderId} - ${message}`)

    const txs = Object.values(order.txMap)
    const confirmedTxs = txs.filter(({ blockHash }) => blockHash)
    const pendingTxs = txs.filter(({ blockHash }) => !blockHash)

    confirmedTxs.forEach(({ type, hash }) => {
      const pendingTx = pendingTxs.find(ptx => ptx.type === type)
      if (pendingTx) {
        order.set(`txMap.${pendingTx.hash}.replacedBy`, hash)
      }
    })

    if (order.isModified()) {
      await order.save()
      log('Updated')
    } else {
      log('Skipped')
    }
  }, { concurrency: 1 })

  console.log('Done')
  process.exit(0)
}

main()
