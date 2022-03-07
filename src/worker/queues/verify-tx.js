require('../../utils/sentry')
require('../../utils/mongo').connect()
const debug = require('debug')('liquality:agent:worker:verify-tx')

const BN = require('bignumber.js')
const { assets } = require('@liquality/cryptoassets')

const { getClient } = require('../../utils/clients')
const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

module.exports = async (job) => {
  debug(job.data)

  const { orderId, type } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) return

  const hash = order[type]

  let asset
  const txMapEntry = order.txMap[hash]

  if (txMapEntry) {
    if (txMapEntry.blockHash) return

    asset = txMapEntry.asset
  } else {
    let side = type.match(/^from|^to/)
    if (!side) throw new Error(`Invalid tx type: ${type}`)
    side = side[0]

    asset = order[side]
  }

  const client = await getClient(asset)
  const tx = await client.chain.getTransactionByHash(hash)

  if (tx.blockHash) {
    if (assets[asset].chain === 'ethereum') {
      const receipt = await client.getMethod('getTransactionReceipt')(hash)

      if (!receipt) {
        throw new RescheduleError(`Reschedule verify-tx for ${order.orderId}:${type}`, asset)
      }

      const { gasUsed } = receipt
      const gas = BN(gasUsed, 16)
      const gasPrice = BN(tx._raw.gasPrice, 16)
      tx.fee = gas.times(gasPrice).toNumber()
    }

    order.addTx(type, tx)

    debug(`Verified ${type} for ${orderId}`)

    return order.save()
  }

  throw new RescheduleError(`Reschedule verify-tx for ${order.orderId}:${type}`, asset)
}
