const debug = require('debug')('liquality:agent:worker:reciprocate-init-swap')

const config = require('../../config')
const Check = require('../../models/Check')
const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async job => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_FUNDED') return

  const fromClient = order.fromClient()
  const toClient = order.toClient()

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

    order.addTx('fromRefundHash', { hash: Date.now(), placeholder: true })
    await order.save()

    await order.log('RECIPROCATE_INIT_SWAP', null, {
      fromBlock: fromCurrentBlockNumber
    })

    return agenda.now('find-refund-tx', { orderId: order.orderId, fromLastScannedBlock: fromCurrentBlockNumber })
  }

  const check = await Check.getCheckForOrder(data.orderId)
  const flag = check.get('flags.reciprocate-init-swap') || {}

  if (flag.reject) {
    debug(`Rejected ${data.orderId}`, flag.message)
    return
  }

  if (
    order.fromAmountUsd > 0 &&
    order.fromAmountUsd < config.threshold.manualAboveFromAmountUsd) {
    if (!flag.approve) {
      const type = 'reciprocate-init-swap'
      const action = 'approve'
      const message = `${order.fromAmountUsd} < ${config.threshold.manualAboveFromAmountUsd}`

      check.set(`flags.${type}`, {
        [action]: new Date(),
        message
      })

      await check.save()

      await order.log('AUTH', 'AUTO_APPROVED', { type, action, message })

      debug(`Auto-approved order ${data.orderId} worth $${order.fromAmountUsd}`)
    }
  } else {
    if (!flag.approve) {
      throw new RescheduleError(`Reschedule ${data.orderId}: reciprocate-init-swap is not approved yet`, order.from)
    }

    debug(`Approved ${data.orderId}`, flag.message)
  }

  const toLastScannedBlock = await toClient.chain.getBlockHeight()

  const toFundTx = await order.initiateSwap()

  debug('Initiated funding transaction', order.orderId, toFundTx.hash)

  order.addTx('toFundHash', toFundTx)
  order.status = 'AGENT_FUNDED'

  const toSecondaryFundTx = toFundTx.secondaryTx

  if (toSecondaryFundTx) {
    order.addTx('toSecondaryFundHash', toSecondaryFundTx)
  }

  await order.save()

  await agenda.now('verify-tx', { orderId: order.orderId, type: 'toFundHash' })

  if (toSecondaryFundTx) {
    await agenda.now('verify-tx', { orderId: order.orderId, type: 'toSecondaryFundHash' })
  }

  await order.log('RECIPROCATE_INIT_SWAP', null, {
    toLastScannedBlock: toLastScannedBlock,
    toFundHash: toFundTx.hash,
    toSecondaryFundHash: order.toSecondaryFundHash
  })

  return agenda.now('find-claim-tx-or-refund', { orderId: order.orderId, toLastScannedBlock })
}
