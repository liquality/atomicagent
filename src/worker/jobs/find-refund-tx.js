const debug = require('debug')('liquality:agent:worker:find-claim-tx-or-refund')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async job => {
  const { agenda, attrs } = job
  const { data } = attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return

  const waitFor = order.swapExpiration - Math.ceil(Date.now() / 1000)
  if (waitFor > 0) {
    throw new RescheduleError(`Waiting for user's swap to expire ${order.orderId}`, waitFor)
  }

  const fromCurrentBlockNumber = await order.fromClient().chain.getBlockHeight()
  const fromRefundTx = await order.findRefundSwapTransaction(data.fromLastScannedBlock, fromCurrentBlockNumber)

  if (!fromRefundTx) {
    job.attrs.data.fromLastScannedBlock = fromCurrentBlockNumber
    await job.save()

    throw new RescheduleError(`Waiting for user to refund ${order.orderId} ${order.toFundHash}`, order.from)
  }

  debug('Node found user\'s refund swap transaction', order.orderId, fromRefundTx.hash)

  order.addTx('fromRefundHash', fromRefundTx)
  await order.save()

  await order.log('FIND_REFUND_TX', null, {
    fromRefundHash: fromRefundTx.hash
  })

  return agenda.now('verify-tx', { orderId: order.orderId, type: 'fromRefundHash' })
}
