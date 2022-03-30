require('../../utils/sentry')
const mongo = require('../../utils/mongo')
const debug = require('debug')('liquality:agent:worker:5-agent-claim')

const Order = require('../../models/Order')

async function process(job) {
  debug(job.data)

  const { orderId } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  if (order.status !== 'USER_CLAIMED') {
    throw new Error(`Order has invalid status: ${orderId} / ${order.status}`)
  }

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

module.exports = (job) => {
  return mongo
    .connect()
    .then(() => process(job))
    .finally(() => mongo.disconnect())
}
