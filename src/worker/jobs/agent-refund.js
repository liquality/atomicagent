const Order = require('../../models/Order')
const debug = require('debug')('liquality:agent:worker')

module.exports = agenda => async (job) => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return

  try {
    await order.toClient().swap.refundSwap(
      order.toFundHash,
      order.toAddress,
      order.toCounterPartyAddress,
      order.secretHash,
      order.nodeExpiration
    )
    debug('Node has refunded the swap', order.orderId)

    order.status = 'AGENT_REFUNDED'
    await order.save()
  } catch (e) {
    console.error(e)
    job.fail(e)
    job.schedule('10 seconds from now')
    await job.save()
  }
}
