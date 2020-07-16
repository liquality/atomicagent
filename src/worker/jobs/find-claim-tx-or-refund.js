const debug = require('debug')('liquality:agent:worker:find-claim-tx-or-refund')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const config = require('../../config')

async function findClaim (order, lastScannedBlock, currentBlock) {
  const toClient = order.toClient()
  const newBlocksExist = !lastScannedBlock || (currentBlock > lastScannedBlock)
  const doesBlockScan = toClient.swap.doesBlockScan
  if (doesBlockScan && !newBlocksExist) return

  const getClaim = blockNumber => toClient.swap.findClaimSwapTransaction(
    order.toFundHash,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    order.nodeSwapExpiration,
    blockNumber
  )

  if (doesBlockScan) {
    let blockNumber = lastScannedBlock ? lastScannedBlock + 1 : currentBlock
    for (;blockNumber <= currentBlock; blockNumber++) {
      const claimTx = await getClaim(blockNumber)

      debug(`Block scanning for ${order.orderId}: ${blockNumber}${claimTx ? ' (Found)' : ''}`)

      if (claimTx) return claimTx
    }
  } else {
    return getClaim()
  }
}

module.exports = agenda => async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'AGENT_FUNDED') return

  const currentBlock = await order.toClient().chain.getBlockHeight()
  const claimTx = await findClaim(order, data.lastScannedBlock, currentBlock)

  if (!claimTx) {
    job.attrs.data.lastScannedBlock = currentBlock
    await job.save()

    const block = await order.toClient().chain.getBlockByNumber(currentBlock)

    if (block.timestamp >= order.nodeSwapExpiration) {
      debug(`Get refund ${order.orderId} (${block.timestamp} >= ${order.nodeSwapExpiration})`)

      const tx = await order.toClient().swap.refundSwap(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration
      )

      debug('Node has refunded the swap', order.orderId)

      order.status = 'AGENT_REFUNDED'
      order.toRefundHash = tx
      await order.save()

      await AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        extra: {
          toBlock: currentBlock,
          toRefundHash: tx,
          toBlockTimestamp: block.timestamp
        },
        context: 'FIND_CLAIM_TX_OR_REFUND'
      })
    } else {
      const when = 'in ' + config.assets[order.to].blockTime
      job.schedule(when)
      await job.save()

      await AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        status: 'AGENT_CLAIM_WAITING',
        extra: {
          toBlock: currentBlock,
          toBlockTimestamp: block.timestamp
        },
        context: 'FIND_CLAIM_TX_OR_REFUND'
      })
    }

    return
  }

  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'

  debug('Node found user\'s claim swap transaction', order.orderId)

  await order.save()

  await AuditLog.create({
    orderId: order.orderId,
    orderStatus: order.status,
    extra: {
      toBlock: currentBlock
    },
    context: 'FIND_CLAIM_TX_OR_REFUND'
  })

  await agenda.now('agent-claim', { orderId: order.orderId })
}
