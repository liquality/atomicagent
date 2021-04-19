const mongoose = require('mongoose')
const config = require('../config')
const BN = require('bignumber.js')
const blockScanOrFind = require('../utils/blockScanOrFind')

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
    {
      value: BN(order.toAmount),
      recipientAddress: order.toAddress,
      refundAddress: order.toCounterPartyAddress,
      secretHash: order.secretHash,
      expiration: order.nodeSwapExpiration
    },
    order.toFundHash,
    // TODO add right block number param
    fromStartBlock
  )

  console.log(`${order.to} claim tx hash: ${toClaimTx.hash}`)

  order.secret = toClaimTx.secret
  await order.save()

  const fees = await fromClient.chain.getFees()
  const fromClaimTx = await fromClient.swap.claimSwap(
    {
      value: BN(order.fromAmount),
      recipientAddress: order.fromCounterPartyAddress,
      refundAddress: order.fromAddress,
      secretHash: order.secretHash,
      expiration: order.swapExpiration
    },
    order.fromFundHash,
    order.secret,
    fees[defaultFee].fee
  )

  order.status = 'AGENT_CLAIMED'
  await order.save()

  console.log(`${order.from} claim tx hash: ${fromClaimTx.hash}`)
}

main()
