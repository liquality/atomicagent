require('../../utils/sentry')
require('../../utils/mongo').connect()
const debug = require('debug')('liquality:agent:worker:4-find-user-claim-or-agent-refund')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async (job) => {
  debug(job.data)

  const { orderId, toLastScannedBlock } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) return

  if (order.status !== 'AGENT_FUNDED') return

  const toClient = await order.toClient()
  let toCurrentBlockNumber

  try {
    toCurrentBlockNumber = await toClient.chain.getBlockHeight()
  } catch (e) {
    throw new RescheduleError(e.message, order.to)
  }

  const toClaimTx = await order.findToClaimSwapTransaction(toLastScannedBlock, toCurrentBlockNumber)

  if (!toClaimTx) {
    await job.update({
      ...job.data,
      toLastScannedBlock: toCurrentBlockNumber
    })

    let toCurrentBlock

    try {
      toCurrentBlock = await toClient.chain.getBlockByNumber(toCurrentBlockNumber)
    } catch (e) {
      throw new RescheduleError(e.message, order.to)
    }

    if (!order.isNodeSwapExpired(toCurrentBlock)) {
      await order.log('FIND_CLAIM_TX_OR_REFUND', 'AGENT_CLAIM_WAITING', {
        toBlockTimestamp: toCurrentBlock.timestamp
      })

      throw new RescheduleError(`Waiting for user to claim ${orderId} ${order.toFundHash}`, order.to)
    }

    debug(`Get refund ${orderId} (${toCurrentBlock.timestamp} >= ${order.nodeSwapExpiration})`)

    const toRefundTx = await order.refundSwap()

    debug('Node has refunded the swap', orderId, toRefundTx.hash)

    order.addTx('toRefundHash', toRefundTx)
    order.status = 'AGENT_REFUNDED'
    await order.save()

    await order.log('FIND_CLAIM_TX_OR_REFUND', null, {
      toRefundHash: toRefundTx.hash,
      toBlockTimestamp: toCurrentBlock.timestamp
    })

    return {
      next: [
        {
          name: 'verify-tx',
          data: {
            orderId,
            type: 'toRefundHash'
          }
        }
      ]
    }
  }

  debug("Node found user's claim swap transaction", orderId, toClaimTx.hash)

  order.secret = toClaimTx.secret
  order.addTx('toClaimHash', toClaimTx)
  order.status = 'USER_CLAIMED'
  await order.save()

  await order.log('FIND_CLAIM_TX_OR_REFUND', null, {
    toClaimHash: toClaimTx.hash,
    secret: toClaimTx.secret
  })

  return {
    next: [
      {
        name: '5-agent-claim',
        data: { orderId, asset: order.from }
      }
    ]
  }
}
