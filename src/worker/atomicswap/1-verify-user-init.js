const debug = require('debug')('liquality:agent:1-verify-user-init')

module.exports = async function (order) {
  if (order.status !== 'USER_FUNDED_UNVERIFIED') {
    throw new Error(`Order has invalid status: ${order.orderId} / ${order.status}`)
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

    return {
      next: true
    }
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

  return {
    next: true
  }
}
