const debug = require('debug')('liquality:agent:worker:verify-user-init-tx')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const { calculateFeeObject } = require('../../utils/fx')
const { RescheduleError } = require('../../utils/errors')

module.exports = async job => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_FUNDED_UNVERIFIED') return

  if (Date.now() > order.expiresAt) { // Expected the swap sooner. Quote expired.
    debug(`Order ${order.orderId} expired due to expiresAt`)
    order.status = 'QUOTE_EXPIRED'

    return Promise.all([
      order.save(),
      AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        context: 'VERIFY_USER_INIT_TX'
      })
    ])
  }

  const fromClient = order.fromClient()

  try {
    const verified = await fromClient.swap.verifyInitiateSwapTransaction(
      order.fromFundHash,
      order.fromAmount,
      order.fromCounterPartyAddress,
      order.fromAddress,
      order.secretHash,
      order.swapExpiration
    )

    if (!verified) {
      throw new RescheduleError(`Reschedule ${order.orderId}: Transaction not found`, order.from)
    }
  } catch (e) {
    await AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      status: 'USER_FUNDING_NOT_FOUND',
      context: 'VERIFY_USER_INIT_TX'
    })

    if (['TxNotFoundError', 'PendingTxError', 'RescheduleError'].includes(e.name)) {
      throw new RescheduleError(e.message, order.from)
    }

    throw e
  }

  const initiationTx = await fromClient.chain.getTransactionByHash(order.fromFundHash)
  if (initiationTx.confirmations < order.minConf) {
    debug(`Reschedule ${order.orderId}: Need more confirmations (${initiationTx.confirmations} < ${order.minConf})`)

    await AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      status: 'USER_FUNDING_NEED_MORE_CONF',
      extra: {
        minConf: order.minConf,
        currentConf: initiationTx.confirmations,
        initiationTxConf: initiationTx.confirmations
      },
      context: 'VERIFY_USER_INIT_TX'
    })

    throw new RescheduleError(
      `Reschedule ${order.orderId}: Need more confirmations (${initiationTx.confirmations} < ${order.minConf})`,
      order.from
    )
  }

  debug('Found & verified funding transaction', order.orderId, order.fromFundHash)

  try {
    const fromSecondaryFundTx = await fromClient.swap.findFundSwapTransaction(
      order.fromFundHash,
      order.fromAmount,
      order.fromCounterPartyAddress,
      order.fromAddress,
      order.secretHash,
      order.swapExpiration
    )

    if (fromSecondaryFundTx) {
      order.fromSecondaryFundHash = fromSecondaryFundTx.hash
      order.set(`fees.${fromSecondaryFundTx.hash}`, calculateFeeObject(order.from, fromSecondaryFundTx.fee, order.fromRateUsd))
    }
  } catch (e) {
    if (['TxNotFoundError', 'PendingTxError'].includes(e.name)) {
      throw new RescheduleError(e.message, order.from)
    }

    throw e
  }

  order.set(`fees.${initiationTx.hash}`, calculateFeeObject(order.from, initiationTx.fee, order.fromRateUsd))
  order.status = 'USER_FUNDED'

  await Promise.all([
    order.save(),
    AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      context: 'VERIFY_USER_INIT_TX'
    })
  ])

  return agenda.now('reciprocate-init-swap', { orderId: order.orderId })
}
