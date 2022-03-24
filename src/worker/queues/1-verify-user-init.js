require('../../utils/sentry')
require('../../utils/mongo').connect()
const debug = require('debug')('liquality:agent:1-verify-user-init')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async (job) => {
  debug(job.data)

  const { orderId } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) {
    debug(`Order not found: ${orderId}`)
    return
  }
  if (order.status !== 'USER_FUNDED_UNVERIFIED') {
    debug(`Order has invalid status: ${orderId} / ${order.status}`)
    return
  }

  const fromClient = await order.fromClient()

  if (order.isQuoteExpired()) {
    debug(`Order ${order.orderId} expired due to expiresAt`)

    order.status = 'QUOTE_EXPIRED'

    await order.save()
    await order.log('VERIFY_USER_INIT_TX')

    return
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

  const newOrder = await Order.findOne({ orderId }).exec()
  debug('New Order', orderId, newOrder.status)

  return {
    next: [
      {
        name: '2-agent-reciprocate',
        data: { orderId, asset: order.to }
      }
    ]
  }
}
