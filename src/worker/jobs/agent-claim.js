const debug = require('debug')('liquality:agent:worker:agent-claim')

const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const config = require('../../config')
const { withLock } = require('../../utils/chainLock')
const { calculateFeeObject } = require('../../utils/fx')
const { RescheduleError } = require('../../utils/errors')

module.exports = async job => {
  const { data } = job.attrs

  const order = await Order.findOne({ orderId: data.orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_CLAIMED') return

  const fromClient = order.fromClient()

  const { defaultFee } = config.assets[order.from]

  const tx = await withLock(order.from, async () => {
    const fees = await fromClient.chain.getFees()

    try {
      return fromClient.swap.claimSwap(
        order.fromFundHash,
        order.fromCounterPartyAddress,
        order.fromAddress,
        order.secret,
        order.swapExpiration,
        fees[defaultFee].fee
      )
    } catch (e) {
      if (['PendingTxError'].includes(e.name)) {
        throw new RescheduleError(e.message, order.from)
      }

      throw e
    }
  })

  debug('Node has claimed the swap', order.orderId, tx.hash)

  order.status = 'AGENT_CLAIMED'
  order.fromClaimHash = tx.hash
  order.set(`fees.${tx.hash}`, calculateFeeObject(order.to, tx.fee, order.toRateUsd))

  return Promise.all([
    order.save(),
    AuditLog.create({
      orderId: order.orderId,
      orderStatus: order.status,
      extra: {
        fromClaimHash: tx.hash
      },
      context: 'AGENT_CLAIM'
    })
  ])
}
