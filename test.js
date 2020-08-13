require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })

// const Bluebird = require('bluebird')
const Order = require('./src/models/Order')

const ORDER_ID = '3b6e67f7-ad08-4d51-b414-be188f866c06'

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

  console.log(`Order was for ${order.from}-${order.to}: ${ORDER_ID}`)
  console.log(`Order's current status is ${order.status}`)

  const userFundTx = await fromClient.chain.getTransactionByHash(order.fromFundHash)
  if (userFundTx) {
    console.log(`- User's funding transaction has ${userFundTx.confirmations} confirmations`)
  } else {
    console.log(`! User's funding transaction is missing`)
  }

  const agentFundTx = await toClient.chain.getTransactionByHash(order.toFundHash)
  if (agentFundTx) {
    console.log(`- Agent's funding transaction has ${agentFundTx.confirmations} confirmations`)
  } else {
    console.log(`! Agent's funding transaction is missing`)
  }

  switch (order.status) {
    case 'AGENT_REFUNDED':
      // USER
      const userClaimTx = await toClient.swap.findClaimSwapTransaction(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration
      )

      if (userClaimTx) {
        console.log(`! User has claimed the swap (conf: ${userClaimTx.confirmations}, tx: ${userClaimTx.hash})`)

        if (order.toClaimHash !== userClaimTx.hash) {
          console.log(`! User's claim tx doesn't match agent's database (db tx: ${order.toClaimHash}, chain tx: ${userClaimTx.hash})`)
        }
      } else {
        console.log(`- User's hasn't claimed the swap`)

        if (order.toClaimHash) {
          console.log(`! User's claim tx is in database (tx: ${order.toClaimHash})`)
        }
      }

      const userRefundTx = await fromClient.swap.findRefundSwapTransaction(
        order.fromFundHash,
        order.fromCounterPartyAddress,
        order.fromAddress,
        order.secretHash,
        order.swapExpiration
      )

      if (userRefundTx) {
        console.log(`- User has claimed the refund (conf: ${userRefundTx.confirmations}, tx: ${userRefundTx.hash})`)
      } else {
        console.log(`! User's refund tx wasn't found on chain`)
      }

      // AGENT
      const agentClaimTx = await fromClient.swap.findClaimSwapTransaction(
        order.fromFundHash,
        order.fromCounterPartyAddress,
        order.fromAddress,
        order.secretHash,
        order.swapExpiration
      )

      if (agentClaimTx) {
        console.log(`! Agent has claimed the swap (conf: ${agentClaimTx.confirmations}, tx: ${agentClaimTx.hash})`)
      } else {
        console.log(`- Agent hasn't claimed the swap`)
      }

      const agentRefundTx = await toClient.swap.findRefundSwapTransaction(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration
      )

      if (agentRefundTx) {
        console.log(`${userClaimTx ? '!' : '-'} Agent has claimed the refund (conf: ${agentRefundTx.confirmations}, tx: ${agentRefundTx.hash})`)

        if (order.toRefundHash !== agentRefundTx.hash) {
          console.log(`! Agent's refund tx doesn't match agent's database (db tx: ${order.toRefundHash}, chain tx: ${agentRefundTx.hash})`)
        }
      } else {
        console.log(`${userClaimTx ? '-' : '!'} Agent's refund transaction wasn't found on chain`)
      }

      // if (userClaimTx && agentRefundTx) {
      //   console.log('> Agent can claim the swap')
      // }
      break
  }

  // await Bluebird.map(orders, async (order, index) => {
  //   const fromClient = order.fromClient()
  //
  //   const fromClaimTx = await fromClient.swap.findClaimSwapTransaction(
  //     order.fromFundHash,
  //     order.fromCounterPartyAddress,
  //     order.fromAddress,
  //     order.secretHash,
  //     order.swapExpiration
  //   )
  //
  //   if (!fromClaimTx) {
  //     console.log(order.orderId, 'Not claimed yet!')
  //     return
  //   }
  //
  //   const fromClaimHash = fromClaimTx.hash
  //
  //   if (order.fromClaimHash) {
  //     if (order.fromClaimHash === fromClaimHash) {
  //       console.log(index, order.orderId, 'Good')
  //     } else {
  //       console.log(index, order.orderId, 'Mismatch', order.fromClaimHash, fromClaimHash)
  //     }
  //
  //     return
  //   }
  //
  //   order.fromClaimHash = fromClaimHash
  //   await order.save()
  //   console.log(index, order.orderId, 'Updated', fromClaimHash)
  //
  //   if (Math.random() < 0.5) {
  //     await new Promise((resolve, reject) => setTimeout(resolve, 1000))
  //   }
  // }, { concurrency: 1 })

  // console.log('Done')
}

main()
