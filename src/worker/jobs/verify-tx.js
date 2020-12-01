const debug = require('debug')('liquality:agent:worker:verify-tx')

const { getClient } = require('../../utils/clients')
const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async job => {
  const { attrs } = job
  const { orderId, type } = attrs.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) return

  const hash = order[type]

  const { asset, blockHash } = order.txMap[hash]
  if (blockHash) return

  const client = getClient(asset)
  const tx = await client.chain.getTransactionByHash(hash)

  if (tx.blockHash) {
    debug(`Verified ${type} for ${orderId}`)

    order.addTx(type, tx)
    return order.save()
  }

  throw new RescheduleError(`Reschedule verify-tx for ${order.orderId}:${type}`, asset)
}
