const debug = require('debug')('liquality:agent:worker:find-claim-tx-or-refund')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async (job) => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'AGENT_FUNDED') return

  const toClient = await order.toClient()
  const toCurrentBlockNumber = await toClient.chain.getBlockHeight()

  const toClaimTx = await order.findToClaimSwapTransaction(data.toLastScannedBlock, toCurrentBlockNumber)

  if (!toClaimTx) {
    job.attrs.data.toLastScannedBlock = toCurrentBlockNumber
    await job.save()

    let toCurrentBlock

    try {
      toCurrentBlock = await toClient.chain.getBlockByNumber(toCurrentBlockNumber)
    } catch (e) {
      if (['BlockNotFoundError'].includes(e.name)) {
        throw new RescheduleError(e.message, order.to)
      }

      throw e
    }

    if (order.isNodeSwapExpired(toCurrentBlock)) {
      debug(`Get refund ${order.orderId} (${toCurrentBlock.timestamp} >= ${order.nodeSwapExpiration})`)

      const toRefundTx = await order.refundSwap()

      debug('Node has refunded the swap', order.orderId, toRefundTx.hash)

      order.addTx('toRefundHash', toRefundTx)
      order.status = 'AGENT_REFUNDED'
      await order.save()

      await order.log('FIND_CLAIM_TX_OR_REFUND', null, {
        toRefundHash: toRefundTx.hash,
        toBlockTimestamp: toCurrentBlock.timestamp
      })

      await agenda.schedule('in 15 seconds', 'verify-tx', { orderId: order.orderId, type: 'toRefundHash' })

      return agenda.now('find-refund-tx', { orderId: order.orderId })
    }

    await order.log('FIND_CLAIM_TX_OR_REFUND', 'AGENT_CLAIM_WAITING', {
      toBlockTimestamp: toCurrentBlock.timestamp
    })

    throw new RescheduleError(`Waiting for user to claim ${order.orderId} ${order.toFundHash}`, order.to)
  }

  debug("Node found user's claim swap transaction", order.orderId, toClaimTx.hash)

  order.secret = toClaimTx.secret
  order.addTx('toClaimHash', toClaimTx)
  order.status = 'USER_CLAIMED'
  await order.save()

  await order.log('FIND_CLAIM_TX_OR_REFUND', null, {
    toClaimHash: toClaimTx.hash,
    secret: toClaimTx.secret
  })

  await agenda.schedule('in 15 seconds', 'verify-tx', { orderId: order.orderId, type: 'toClaimHash' })

  return agenda.now('agent-claim', { orderId: order.orderId })
}
