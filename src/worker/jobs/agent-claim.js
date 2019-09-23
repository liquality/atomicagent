const Order = require('../../models/Order')

module.exports = agenda => async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return done()

  try {
    // TODO: remove wait() from CAL
    await order.fromClient().swap.claimSwap(
      order.fromFundHash,
      order.fromCounterPartyAddress,
      order.fromAddress,
      order.secret,
      order.swapExpiration
    )
    console.log('Node has claimed the swap', order.orderId)

    order.status = 'AGENT_CLAIMED'
    await order.save()

    done()
  } catch (e) {
    console.error(e)
    job.fail(e)
    job.schedule('10 seconds from now')
    await job.save()
  }
}
