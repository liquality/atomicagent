const debug = require('debug')('liquality:agent:worker:find-claim-tx-or-refund')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const config = require('../../config')

module.exports = async job => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'AGENT_FUNDED') return

  const toClient = order.toClient()
  const claimTx = await toClient.swap.findClaimSwapTransaction(
    order.toFundHash,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    order.nodeSwapExpiration
  )

  if (!claimTx) {
    const currentBlock = await toClient.chain.getBlockHeight()
    const block = await toClient.chain.getBlockByNumber(currentBlock)

    if (block.timestamp >= order.nodeSwapExpiration) {
      debug(`Get refund ${order.orderId} (${block.timestamp} >= ${order.nodeSwapExpiration})`)

      const tx = await toClient.swap.refundSwap(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration
      )

      debug('Node has refunded the swap', order.orderId)

      order.status = 'AGENT_REFUNDED'
      order.toRefundHash = tx.hash
      await order.save()

      await AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        extra: {
          toRefundHash: tx.hash,
          toBlockTimestamp: block.timestamp
        },
        context: 'FIND_CLAIM_TX_OR_REFUND'
      })

      await agenda.now('verify-tx', {
        orderId: order.orderId,
        key: 'toRefundHash',
        asset: order.to,
        startBlock: currentBlock,
        minConf: 1,
        maxBlocks: 10,
        next: {
          action: 'UPDATE_ORDER',
          payload: {
            status: 'AGENT_REFUNDED'
          }
        }
      })
    } else {
      const when = 'in ' + config.assets[order.to].blockTime
      job.schedule(when)
      await job.save()

      await AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        status: 'AGENT_CLAIM_WAITING',
        extra: {
          toBlockTimestamp: block.timestamp
        },
        context: 'FIND_CLAIM_TX_OR_REFUND'
      })
    }

    return
  }

  order.toClaimHash = claimTx.hash
  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'

  debug('Node found user\'s claim swap transaction', order.orderId)

  await order.save()

  await AuditLog.create({
    orderId: order.orderId,
    orderStatus: order.status,
    extra: {
      toClaimHash: claimTx.hash,
      secret: claimTx.secret
    },
    context: 'FIND_CLAIM_TX_OR_REFUND'
  })

  await agenda.now('agent-claim', { orderId: order.orderId })
}
