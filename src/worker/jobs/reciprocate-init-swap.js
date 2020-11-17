const debug = require('debug')('liquality:agent:worker:reciprocate-init-swap')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const config = require('../../config')
const { withLock } = require('../../utils/chainLock')
const { calculateFeeObject } = require('../../utils/fx')

module.exports = async job => {
  const { agenda } = job
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_FUNDED') return

  const fromClient = order.fromClient()
  const toClient = order.toClient()

  const currentBlock = await fromClient.chain.getBlockHeight()
  const block = await fromClient.chain.getBlockByNumber(currentBlock)

  if (block.timestamp >= order.swapExpiration) { // no need to continue
    debug(`Order ${order.orderId} expired due to swapExpiration`)

    order.status = 'SWAP_EXPIRED'

    return Promise.all([
      order.save(),
      AuditLog.create({
        orderId: order.orderId,
        orderStatus: order.status,
        extra: {
          fromBlock: currentBlock
        },
        context: 'RECIPROCATE_INIT_SWAP'
      })
    ])
  }

  const toLastScannedBlock = await toClient.chain.getBlockHeight()

  const { defaultFee } = config.assets[order.to]

  const tx = await withLock(order.to, async () => {
    const fees = await toClient.chain.getFees()

    return toClient.swap.initiateSwap(
      order.toAmount,
      order.toAddress,
      order.toCounterPartyAddress,
      order.secretHash,
      order.nodeSwapExpiration,
      fees[defaultFee].fee
    )
  })

  debug('Initiated funding transaction', order.orderId, tx.hash)

  order.toFundHash = tx.hash
  order.set(`fees.${tx.hash}`, calculateFeeObject(order.to, tx.fee, order.toRateUsd))

  const toSecondaryFundTx = tx.secondaryTx

  if (toSecondaryFundTx) {
    order.toSecondaryFundHash = toSecondaryFundTx.hash
    order.set(`fees.${toSecondaryFundTx.hash}`, calculateFeeObject(order.to, toSecondaryFundTx.fee, order.toRateUsd))
  }

  order.status = 'AGENT_FUNDED'

  await Promise.all([
    order.save(),
    AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      extra: {
        toLastScannedBlock: toLastScannedBlock,
        toFundHash: tx.hash,
        toSecondaryFundHash: order.toSecondaryFundHash
      },
      context: 'RECIPROCATE_INIT_SWAP'
    })
  ])

  return agenda.now('find-claim-tx-or-refund', { orderId: order.orderId, toLastScannedBlock })
}
