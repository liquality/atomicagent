const debug = require('debug')('liquality:agent:worker:fund-swap')

const Order = require('../../models/Order')

module.exports = async job => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'AGENT_CONTRACT_CREATED') return

  const fromClient = order.fromClient()

  const fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
  const fromCurrentBlock = await fromClient.chain.getBlockByNumber(fromCurrentBlockNumber)

  const stop = order.isQuoteExpired() || order.isSwapExpired(fromCurrentBlock) || order.isNodeSwapExpired(fromCurrentBlock)
  if (stop) {
    if (order.isQuoteExpired()) {
      debug(`Order ${order.orderId} expired due to expiresAt`)
      order.status = 'QUOTE_EXPIRED'
    }

    if (order.isSwapExpired(fromCurrentBlock)) {
      debug(`Order ${order.orderId} expired due to swapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    if (order.isNodeSwapExpired(fromCurrentBlock)) {
      debug(`Order ${order.orderId} expired due to nodeSwapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    order.addTx('fromRefundHash', { placeholder: true })
    await order.save()

    await order.log('FUND_SWAP', null, {
      fromBlock: fromCurrentBlockNumber
    })

    return agenda.now('find-refund-tx', { orderId: order.orderId, fromLastScannedBlock: fromCurrentBlockNumber })
  }

  const toSecondaryFundTx = await order.fundSwap()
  if (toSecondaryFundTx) {
    debug('Initiated secondary funding transaction', order.orderId, toSecondaryFundTx.hash)
    order.addTx('toSecondaryFundHash', toSecondaryFundTx)
  }

  order.status = 'AGENT_FUNDED'
  await order.save()

  if (toSecondaryFundTx) {
    await agenda.now('verify-tx', { orderId: order.orderId, type: 'toSecondaryFundHash' })
  }

  await order.log('FUND_SWAP', null, {
    toSecondaryFundHash: order.toSecondaryFundHash
  })

  return agenda.now('find-claim-tx-or-refund', { orderId: order.orderId, toLastScannedBlock: data.toLastScannedBlock })
}
