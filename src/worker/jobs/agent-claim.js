const debug = require('debug')('liquality:agent:worker:agent-claim')

const Order = require('../../models/Order')

module.exports = agenda => async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return

  await order.fromClient().swap.claimSwap(
    order.fromFundHash,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secret,
    order.swapExpiration
  )

  debug('Node has claimed the swap', order.orderId)

  order.status = 'AGENT_CLAIMED'
  await order.save()
}
