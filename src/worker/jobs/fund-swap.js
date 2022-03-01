const debug = require('debug')('liquality:agent:worker:fund-swap')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async (job) => {
  const { queue } = job.queue
  const { data } = job.data

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'AGENT_CONTRACT_CREATED') return

  const fromClient = await order.fromClient()

  const fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
  let fromCurrentBlock

  try {
    fromCurrentBlock = await fromClient.chain.getBlockByNumber(fromCurrentBlockNumber)
  } catch (e) {
    if (['BlockNotFoundError'].includes(e.name)) {
      throw new RescheduleError(e.message, order.from)
    }

    throw e
  }

  const stop =
    order.isQuoteExpired() || order.isSwapExpired(fromCurrentBlock) || order.isNodeSwapExpired(fromCurrentBlock)
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

    return queue.add('find-refund-tx', { orderId: order.orderId, fromLastScannedBlock: fromCurrentBlockNumber })
  }

  const toSecondaryFundTx = await order.fundSwap()
  if (toSecondaryFundTx) {
    debug('Initiated secondary funding transaction', order.orderId, toSecondaryFundTx.hash)
    order.addTx('toSecondaryFundHash', toSecondaryFundTx)
  }

  order.status = 'AGENT_FUNDED'
  await order.save()

  if (toSecondaryFundTx) {
    await queue.add('verify-tx', { orderId: order.orderId, type: 'toSecondaryFundHash' }, { delay: 15000 })
  }

  await order.log('FUND_SWAP', null, {
    toSecondaryFundHash: order.toSecondaryFundHash
  })

  return queue.add(
    'find-claim-tx-or-refund',
    {
      orderId: order.orderId,
      toLastScannedBlock: data.toLastScannedBlock
    },
    { delay: 15000 }
  )
}
