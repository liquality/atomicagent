const Order = require('../../models/Order')

module.exports = agenda => async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return done()

  const nodeExp = order.swapExpiration - (60 * 60 * 6)

  const tx = await order.toClient().swap.initiateSwap(order.toAmount, order.toAddress, order.toCounterPartyAddress, order.secretHash, nodeExp)
  console.log('Initiated funding transaction', order.orderId, tx)

  order.toFundHash = tx
  order.status = 'AGENT_FUNDED'
  await order.save()
  await agenda.now('find-claim-swap-tx', { orderId: order.orderId })

  done()
}
