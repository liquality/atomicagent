const Order = require('../../models/Order')
const debug = require('debug')('liquality:agent:worker')

module.exports = agenda => async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return

  if (Date.now() > order.expiresAt) { // Expected the swap sooner. Quote expired.
    debug(`Order ${order.orderId} expired due to expiresAt`)
    order.status = 'QUOTE_EXPIRED'
    await order.save()
    return
  }

  const verified = await order.fromClient().swap.verifyInitiateSwapTransaction(
    order.fromFundHash,
    order.fromAmount,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secretHash,
    order.swapExpiration
  )

  const initiationTx = await order.fromClient().chain.getTransactionByHash(order.fromFundHash)
  const accepted = verified && initiationTx.confirmations >= order.minConf

  if (!accepted) {
    // TODO: schedule based on block times?
    throw new Error('Transaction hasn\'t been verified yet')
  }

  debug('Found & verified funding transaction', order.orderId)

  order.status = 'USER_FUNDED'
  await order.save()

  await agenda.now('reciprocate-init-swap', { orderId: order.orderId })
}
