require('../../utils/sentry')
const mongo = require('../../utils/mongo')
const debug = require('debug')('liquality:agent:worker:2-agent-approve')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

async function process(job) {
  debug(job.data)

  const { orderId } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  // approve step only after user funded
  if (order.status !== 'USER_FUNDED') {
    throw new Error(`Order has invalid status: ${orderId} / ${order.status}`)
  }

  const fromClient = await order.fromClient()

  let fromCurrentBlockNumber
  let fromCurrentBlock

  try {
    fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
    fromCurrentBlock = await fromClient.chain.getBlockByNumber(fromCurrentBlockNumber)
  } catch (e) {
    throw new RescheduleError(e.message, order.from)
  }

  const stop =
    order.isQuoteExpired() || order.isSwapExpired(fromCurrentBlock) || order.isNodeSwapExpired(fromCurrentBlock)
  if (stop) {
    if (order.isQuoteExpired()) {
      debug(`Order ${orderId} expired due to expiresAt`)
      order.status = 'QUOTE_EXPIRED'
    }

    if (order.isSwapExpired(fromCurrentBlock)) {
      debug(`Order ${orderId} expired due to swapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    if (order.isNodeSwapExpired(fromCurrentBlock)) {
      debug(`Order ${orderId} expired due to nodeSwapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    await order.save()

    await order.log('APPROVE_SWAP', null, { fromBlock: fromCurrentBlockNumber })

    debug(`Stopping ${orderId} - ${order.status}`)

    return
  }

  const approveTx = await order.approveSwap()

  if (approveTx) {
    debug('Initiated approve transaction', orderId, approveTx.hash)
    order.addTx('toSecondaryFundHash', approveTx)
  }

  order.status = 'AGENT_APPROVED'
  await order.save()

  const next = []

  if (approveTx) {
    next.push({
      name: 'verify-tx',
      data: {
        orderId,
        type: 'toSecondaryFundHash'
      }
    })
  }

  await order.log('APPROVE_SWAP', null, { toSecondaryFundHash: order.toSecondaryFundHash })

  next.push({
    name: '3-agent-reciprocate',
    data: { orderId, asset: order.to },
    opts: {
      delay: 1000 * 15
    }
  })

  return { next }
}

module.exports = (job) => {
  return mongo
    .connect()
    .then(() => process(job))
    .finally(() => mongo.disconnect())
}
