require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })

// const Bluebird = require('bluebird')
const Order = require('./src/models/Order')

const ORDER_ID = 'cffe24d5-e404-47a7-b918-21d2ca30626e'

// const AGENT_CLAIM_TX = 'fromClaimHash'
// const AGENT_REFUND_TX = 'toRefundHash'
// const USER_CLAIM_TX = 'toClaimHash'
// const USER_REFUND_TX = 'fromRefundHash'

async function main () {
  const order = await Order.findOne({
    orderId: ORDER_ID
  }).exec()

  const fromClient = order.fromClient()
  const toClient = order.toClient()

  console.log(
    order.toFundHash,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    order.nodeSwapExpiration
  )

  const claimTx = await toClient.swap.findClaimSwapTransaction(
    order.toFundHash,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    order.nodeSwapExpiration
  )

  console.log(claimTx)

  order.secret = claimTx.secret
  await order.save()

  const tx = await fromClient.swap.claimSwap(
    order.fromFundHash,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secret,
    order.swapExpiration
  )

  console.log(tx)
}

main()
