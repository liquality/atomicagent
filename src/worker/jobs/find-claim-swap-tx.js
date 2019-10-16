const Order = require('../../models/Order')

async function findClaim (order, lastScannedBlock, currentBlock) {
  const nodeExp = order.swapExpiration - (60 * 60 * 6)
  const newBlocksExist = !lastScannedBlock || (currentBlock > lastScannedBlock)
  if (newBlocksExist) {
    let blockNumber = lastScannedBlock ? lastScannedBlock + 1 : currentBlock
    for (;blockNumber <= currentBlock; blockNumber++) {
      const claimTx = await order.toClient().swap.findClaimSwapTransaction(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        nodeExp,
        blockNumber
      )
      if (claimTx) return claimTx
    }
  }
}

module.exports = agenda => async (job) => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return

  const currentBlock = await order.toClient().chain.getBlockHeight() // TODO: order (initator) should provide start block

  const claimTx = await findClaim(order, data.lastScannedBlock, currentBlock)
  const lastScannedBlock = currentBlock // TODO: persist last scanned block to prevent situation where agent going offline loses state.

  if (!claimTx) {
    // TODO: use block times as schedule?
    agenda.schedule('in 10 seconds', 'find-claim-swap-tx', { orderId: data.orderId, lastScannedBlock })
    // TODO: stop looking after a while (expiration)
    return
  }

  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'
  await order.save()
  await agenda.now('agent-claim', { orderId: order.orderId })
}
