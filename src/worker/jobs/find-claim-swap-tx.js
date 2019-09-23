const Order = require('../../models/Order')

module.exports = agenda => async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return done()

  const nodeExp = order.swapExpiration - (60 * 60 * 6)

  // TODO: remove wait() from CAL
  const claimTx = await order.toClient().swap.findClaimSwapTransaction(
    order.toFundHash,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    nodeExp
  )
  console.log('Found claim transaction', claimTx)

  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'
  await order.save()
  await agenda.now('agent-claim', { orderId: order.orderId })

  done()
}
