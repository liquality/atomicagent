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
  const toClient = order.toClient()

  const toClaimTx = await toClient.swap.findClaimSwapTransaction(
    order.toFundHash,
    order.toAmount,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    order.nodeSwapExpiration
  )

  console.log(`${order.to} claim tx hash: ${toClaimTx.hash}`)

  order.secret = toClaimTx.secret
  await order.save()

  const fromClaimTx = await fromClient.swap.claimSwap(
    order.fromFundHash,
    order.fromAmount,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secretHash,
    order.swapExpiration,
    order.secret
  )

  order.status = 'AGENT_CLAIMED'
  await order.save()

  console.log(`${order.from} claim tx hash: ${fromClaimTx.hash}`)
}

main()
