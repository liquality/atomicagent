const debug = require('debug')('liquality:agent:worker:find-claim-tx-or-refund')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const config = require('../../config')
const blockScanOrFind = require('../../utils/blockScanOrFind')
const { withLock } = require('../../utils/chainLock')
const { calculateFeeObject } = require('../../utils/fx')
const { RescheduleError } = require('../../utils/errors')

module.exports = async job => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'AGENT_FUNDED') return

  const toClient = order.toClient()
  const toCurrentBlock = await order.toClient().chain.getBlockHeight()
  const claimTx = await blockScanOrFind(toClient, async blockNumber => {
    try {
      const tx = await toClient.swap.findClaimSwapTransaction(
        order.toFundHash,
        order.toAddress,
        order.toCounterPartyAddress,
        order.secretHash,
        order.nodeSwapExpiration,
        blockNumber
      )

      if (toClient.swap.doesBlockScan) {
        debug(`Block scanning for ${order.orderId}: ${blockNumber}${tx ? ' (Found)' : ''}`)
      }

      return tx
    } catch (e) {
      if (['PendingTxError', 'BlockNotFoundError'].includes(e.name)) {
        throw new RescheduleError(e.message, order.to)
      }

      throw e
    }
  }, data.toLastScannedBlock, toCurrentBlock)

  if (!claimTx) {
    job.attrs.data.toLastScannedBlock = toCurrentBlock
    await job.save()

    const block = await toClient.chain.getBlockByNumber(toCurrentBlock)

    if (block.timestamp >= order.nodeSwapExpiration) {
      debug(`Get refund ${order.orderId} (${block.timestamp} >= ${order.nodeSwapExpiration})`)

      const { defaultFee } = config.assets[order.to]

      const tx = await withLock(order.to, async () => {
        const fees = await toClient.chain.getFees()

        try {
          return toClient.swap.refundSwap(
            order.toFundHash,
            order.toAddress,
            order.toCounterPartyAddress,
            order.secretHash,
            order.nodeSwapExpiration,
            fees[defaultFee].fee
          )
        } catch (e) {
          if (['PendingTxError'].includes(e.name)) {
            throw new RescheduleError(e.message, order.to)
          }

          throw e
        }
      })

      debug('Node has refunded the swap', order.orderId, tx.hash)

      order.status = 'AGENT_REFUNDED'
      order.toRefundHash = tx.hash
      order.set(`fees.${tx.hash}`, calculateFeeObject(order.to, tx.fee, order.toRateUsd))

      return Promise.all([
        order.save(),
        AuditLog.create({
          orderId: order.orderId,
          orderStatus: order.status,
          extra: {
            toRefundHash: tx.hash,
            toBlockTimestamp: block.timestamp
          },
          context: 'FIND_CLAIM_TX_OR_REFUND'
        })
      ])
    }

    await AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      status: 'AGENT_CLAIM_WAITING',
      extra: {
        toBlockTimestamp: block.timestamp
      },
      context: 'FIND_CLAIM_TX_OR_REFUND'
    })

    throw new RescheduleError(`Waiting for user to claim ${order.orderId} ${order.toFundHash}`, order.to)
  }

  order.toClaimHash = claimTx.hash
  order.set(`fees.${claimTx.hash}`, calculateFeeObject(order.to, claimTx.fee, order.toRateUsd))
  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'

  debug('Node found user\'s claim swap transaction', order.orderId, claimTx.hash)

  await Promise.all([
    order.save(),
    AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      extra: {
        toClaimHash: claimTx.hash,
        secret: claimTx.secret
      },
      context: 'FIND_CLAIM_TX_OR_REFUND'
    })
  ])

  return agenda.now('agent-claim', { orderId: order.orderId })
}
