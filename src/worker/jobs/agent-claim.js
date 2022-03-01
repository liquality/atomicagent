const debug = require('debug')('liquality:agent:worker:agent-claim')

const Order = require('../../models/Order')

module.exports = async (job) => {
  const { queue, data } = job

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_CLAIMED') return

  const fromClaimTx = await order.claimSwap()

  debug('Node has claimed the swap', order.orderId, fromClaimTx.hash)

  order.addTx('fromClaimHash', fromClaimTx)
  order.status = 'AGENT_CLAIMED'
  await order.save()

  await order.log('AGENT_CLAIM', null, {
    fromClaimHash: fromClaimTx.hash
  })

  //TODO schedule in 15 seconds
  return queue.add('verify-tx', { orderId: order.orderId, type: 'fromClaimHash' }, { delay: 15000 })
}
