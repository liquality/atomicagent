require('../../utils/sentry')
require('../../utils/mongo').connect()
const debug = require('debug')('liquality:agent:worker:agent-claim')

const Order = require('../../models/Order')

module.exports = async (job) => {
  debug(job.data)

  const { orderId } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) return
  if (order.status !== 'USER_CLAIMED') return

  const fromClaimTx = await order.claimSwap()

  debug('Node has claimed the swap', orderId, fromClaimTx.hash)

  order.addTx('fromClaimHash', fromClaimTx)
  order.status = 'AGENT_CLAIMED'
  await order.save()

  await order.log('AGENT_CLAIM', null, {
    fromClaimHash: fromClaimTx.hash
  })

  return {
    next: [
      {
        name: 'verify-tx',
        data: {
          orderId,
          type: 'fromClaimHash'
        }
      }
    ]
  }
}