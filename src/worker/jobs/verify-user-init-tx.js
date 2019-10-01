const Order = require('../../models/Order')

module.exports = agenda => async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return done()

  order.status = 'AGENT_PENDING'
  await order.save()

  // TODO: remove wait() from CAL
  await order.fromClient().swap.verifyInitiateSwapTransaction(
    order.fromFundHash,
    order.amount,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secretHash,
    order.swapExpiration
  )
  console.log('Found & verified funding transaction', order.orderId)

  order.status = 'USER_FUNDED'
  await order.save()
  await agenda.now('reciprocate-init-swap', { orderId: order.orderId })

  done()
}
