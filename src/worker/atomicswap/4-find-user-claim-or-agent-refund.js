const debug = require('debug')('liquality:agent:worker:4-find-user-claim-or-agent-refund')

module.exports = async function (order, job) {
  if (order.status !== 'AGENT_FUNDED') {
    throw new Error(`Order has invalid status: ${order.orderId} / ${order.status}`)
  }

  const toClient = await order.toClient()
  let toCurrentBlockNumber

  try {
    toCurrentBlockNumber = await toClient.chain.getBlockHeight()
  } catch (e) {
    debug(e)

    return {
      next: true
    }
  }

  const toClaimTx = await order.findToClaimSwapTransaction(order.toLastScannedBlock, toCurrentBlockNumber)

  if (!toClaimTx) {
    if (job) {
      await job.update({
        ...job.data,
        toLastScannedBlock: toCurrentBlockNumber
      })
    }

    let toCurrentBlock

    try {
      toCurrentBlock = await toClient.chain.getBlockByNumber(toCurrentBlockNumber)
    } catch (e) {
      debug(e)

      return {
        next: true
      }
    }

    if (!order.isNodeSwapExpired(toCurrentBlock)) {
      await order.log('FIND_CLAIM_TX_OR_REFUND', 'AGENT_CLAIM_WAITING', {
        toBlockTimestamp: toCurrentBlock.timestamp
      })

      debug(`Waiting for user to claim ${order.orderId} ${order.toFundHash}`)

      return {
        next: true
      }
    }

    debug(`Get refund ${order.orderId} (${toCurrentBlock.timestamp} >= ${order.nodeSwapExpiration})`)

    const toRefundTx = await order.refundSwap()

    debug('Node has refunded the swap', order.orderId, toRefundTx.hash)

    order.addTx('toRefundHash', toRefundTx)
    order.status = 'AGENT_REFUNDED'
    await order.save()

    await order.log('FIND_CLAIM_TX_OR_REFUND', null, {
      toRefundHash: toRefundTx.hash,
      toBlockTimestamp: toCurrentBlock.timestamp
    })

    return {
      verify: 'toRefundHash'
    }
  }

  debug("Node found user's claim swap transaction", order.orderId, toClaimTx.hash)

  order.secret = toClaimTx.secret
  order.addTx('toClaimHash', toClaimTx)
  order.status = 'USER_CLAIMED'
  await order.save()

  await order.log('FIND_CLAIM_TX_OR_REFUND', null, {
    toClaimHash: toClaimTx.hash,
    secret: toClaimTx.secret
  })

  return {
    next: true
  }
}
