const debug = require('debug')('liquality:agent:worker:verify-user-init-tx')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async (job) => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_FUNDED_UNVERIFIED') return

  const fromClient = await order.fromClient()

  if (order.isQuoteExpired()) {
    debug(`Order ${order.orderId} expired due to expiresAt`)

    order.addTx('fromRefundHash', { placeholder: true })
    order.status = 'QUOTE_EXPIRED'
    await order.save()

    await order.log('VERIFY_USER_INIT_TX')

    const fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
    return agenda.now('find-refund-tx', { orderId: order.orderId, fromLastScannedBlock: fromCurrentBlockNumber })
  }

  await order.verifyInitiateSwapTransaction()

  const fromFundTx = await fromClient.chain.getTransactionByHash(order.fromFundHash)

  if (fromFundTx.confirmations < order.minConf) {
    debug(`Reschedule ${order.orderId}: Need more confirmations (${fromFundTx.confirmations} < ${order.minConf})`)

    await order.log('VERIFY_USER_INIT_TX', 'USER_FUNDING_NEED_MORE_CONF', {
      minConf: order.minConf,
      currentConf: fromFundTx.confirmations,
      initiationTxConf: fromFundTx.confirmations
    })

    throw new RescheduleError(
      `Reschedule ${order.orderId}: Need more confirmations (${fromFundTx.confirmations} < ${order.minConf})`,
      order.from
    )
  }

  debug('Found & verified funding transaction', order.orderId, order.fromFundHash)

  const fromSecondaryFundTx = await order.findFromFundSwapTransaction()

  if (fromSecondaryFundTx) {
    order.addTx('fromSecondaryFundHash', fromSecondaryFundTx)
  }

  order.addTx('fromFundHash', fromFundTx)
  order.status = 'USER_FUNDED'

  await order.save()
  await order.log('VERIFY_USER_INIT_TX')

  return agenda.now('reciprocate-init-swap', { orderId: order.orderId })
}
