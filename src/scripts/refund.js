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

const Order = require('../models/Order')

async function main () {
  const order = await Order.findOne({
    orderId: process.env.ORDER_ID
  }).exec()

  const fromClient = order.fromClient()

  const fromRefundTx = await fromClient.swap.refundSwap(
    order.toFundHash,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    order.nodeSwapExpiration
  )

  order.status = 'AGENT_REFUNDED'
  await order.save()

  console.log(`${order.from} refund tx hash: ${fromRefundTx.hash}`)
}

main()
