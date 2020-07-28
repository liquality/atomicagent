const debug = require('debug')('liquality:agent:worker:agent-claim')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')

module.exports = agenda => async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_CLAIMED') return

  const tx = await order.fromClient().swap.claimSwap(
    order.fromFundHash,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secret,
    order.swapExpiration
  )

  debug('Node has claimed the swap', order.orderId)

  order.status = 'AGENT_CLAIMED'
  order.fromClaimHash = tx
  await order.save()

  await AuditLog.create({
    orderId: order.orderId,
    orderStatus: order.status,
    extra: {
      fromClaimHash: tx
    },
    context: 'AGENT_CLAIM'
  })
}
