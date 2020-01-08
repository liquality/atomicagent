const Order = require('../../models/Order')
const debug = require('debug')('liquality:agent:worker')

const TEST_ENV = process.env.NODE_ENV === 'test'

async function findClaim (order, lastScannedBlock, currentBlock) {
  const newBlocksExist = !lastScannedBlock || (currentBlock > lastScannedBlock)
  if (newBlocksExist) {
    let blockNumber = lastScannedBlock ? lastScannedBlock + 1 : currentBlock

    for (;blockNumber <= currentBlock; blockNumber++) {
      const claimTx = await order.toClient().swap.findClaimSwapTransaction(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration,
        blockNumber
      )

      if (claimTx) return claimTx
    }
  }
}

module.exports = agenda => async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return

  const currentBlock = await order.toClient().chain.getBlockHeight()
  const claimTx = await findClaim(order, data.lastScannedBlock, currentBlock)

  if (!claimTx) {
    const block = await order.toClient().chain.getBlockByNumber(currentBlock)

    if (block.timestamp >= order.nodeSwapExpiration) {
      await agenda.now('agent-refund', { orderId: order.orderId })
    } else {
      const when = TEST_ENV ? 'in 2 seconds' : 'in 10 seconds'
      await agenda.schedule(when, 'find-claim-swap-tx', { orderId: data.orderId, lastScannedBlock: currentBlock })
    }

    return
  }

  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'

  debug('Node found user\'s claim swap transaction', order.orderId)

  await order.save()
  await agenda.now('agent-claim', { orderId: order.orderId })
}
