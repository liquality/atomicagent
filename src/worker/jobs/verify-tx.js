const debug = require('debug')('liquality:agent:worker:verify-tx')
const BN = require('bignumber.js')
const cryptoassets = require('@liquality/cryptoassets').default

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
    const assetType = cryptoassets[asset].type
    const chain = assetType === 'erc20' ? 'ETH' : asset

    if (chain === 'ETH') {
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
