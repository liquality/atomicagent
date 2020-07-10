const debug = require('debug')('liquality:agent:worker:verify-user-init-tx')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const config = require('../../config')

module.exports = agenda => async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_FUNDED_UNVERIFIED') return

  if (Date.now() > order.expiresAt) { // Expected the swap sooner. Quote expired.
    debug(`Order ${order.orderId} expired due to expiresAt`)
    order.status = 'QUOTE_EXPIRED'
    await order.save()

    await AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status
    })

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

  try {
    if (!verified) {
      debug(`Reschedule ${order.orderId}: Transaction not found`)

      await AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        status: 'USER_FUNDING_NOT_FOUND'
      })

      throw new Error('Reschedule')
    }

    const initiationTx = await order.fromClient().chain.getTransactionByHash(order.fromFundHash)
    if (initiationTx.confirmations < order.minConf) {
      debug(`Reschedule ${order.orderId}: Need more confirmations (${initiationTx.confirmations} < ${order.minConf})`)

      await AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        status: 'USER_FUNDING_NEED_MORE_CONF',
        extra: {
          minConf: order.minConf,
          initiationTxConf: initiationTx.confirmations
        }
      })

      throw new Error('Reschedule')
    }
  } catch (e) {
    const when = 'in ' + config.assets[order.from].blockTime
    debug(`Reschedule ${order.orderId} ${when}`)

    job.schedule(when)
    await job.save()
    return
  }

  debug('Found & verified funding transaction', order.orderId)

  order.status = 'USER_FUNDED'
  await order.save()

  await AuditLog.create({
    orderId: order.orderId,
    orderStatus: order.status
  })

  await agenda.now('reciprocate-init-swap', { orderId: order.orderId })
}
