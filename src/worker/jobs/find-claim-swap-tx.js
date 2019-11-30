const Order = require('../../models/Order')
const debug = require('debug')('liquality:agent:worker')

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
        order.nodeExpiration,
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

  const currentBlock = await order.toClient().chain.getBlockHeight() // TODO: order (initator) should provide start block

  const claimTx = await findClaim(order, data.lastScannedBlock, currentBlock)
  const lastScannedBlock = currentBlock // TODO: persist last scanned block to prevent situation where agent going offline loses state.

  if (!claimTx) {
    const block = await order.toClient().chain.getBlockByNumber(currentBlock)
    if (block.timestamp <= order.nodeExpiration) {
      // TODO: use block times as schedule?
      await agenda.schedule('in 10 seconds', 'find-claim-swap-tx', { orderId: data.orderId, lastScannedBlock })
      return
    } else {
      await agenda.now('agent-refund', { orderId: order.orderId })
      return
    }
  }

  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'

  debug('Node found user\'s claim swap transaction', order.orderId)

  await order.save()
  await agenda.now('agent-claim', { orderId: order.orderId })
}
