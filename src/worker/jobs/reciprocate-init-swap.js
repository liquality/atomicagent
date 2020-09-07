const debug = require('debug')('liquality:agent:worker:reciprocate-init-swap')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')

module.exports = agenda => async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_FUNDED') return

  const currentBlock = await order.fromClient().chain.getBlockHeight()
  const block = await order.fromClient().chain.getBlockByNumber(currentBlock)

  if (block.timestamp >= order.swapExpiration) { // no need to continue
    debug(`Order ${order.orderId} expired due to swapExpiration`)
    order.status = 'SWAP_EXPIRED'
    await order.save()

    await AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      extra: {
        fromBlock: currentBlock
      },
      context: 'RECIPROCATE_INIT_SWAP'
    })

    return
  }

  const lastScannedBlock = await order.toClient().chain.getBlockHeight()
  const tx = await order.toClient().swap.initiateSwap(order.toAmount, order.toAddress, order.toCounterPartyAddress, order.secretHash, order.nodeSwapExpiration)
  debug('Initiated funding transaction', order.orderId, tx.hash)

  order.toFundHash = tx.hash
  order.status = 'AGENT_FUNDED'

  await order.save()

  await AuditLog.create({
    orderId: order.orderId,
    orderStatus: order.status,
    extra: {
      toBlock: lastScannedBlock,
      toFundHash: tx.hash
    },
    context: 'RECIPROCATE_INIT_SWAP'
  })

  await agenda.now('find-claim-tx-or-refund', { orderId: order.orderId, lastScannedBlock })
}
