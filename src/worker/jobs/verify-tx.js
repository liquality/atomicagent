const AuditLog = require('../../models/AuditLog')
const Order = require('../../models/Order')
const config = require('../../config')
const { getClient } = require('../../utils/clients')

module.exports = agenda => async job => {
  const { orderId, key, asset, startBlock, minConf, maxBlocks, next } = job.attrs.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) return

  const client = getClient(asset)
  const txHash = order[key]

  const initiationTx = await client.chain.getTransactionByHash(txHash)
  const currentBlock = await client.chain.getBlockHeight()

  if (initiationTx.confirmations >= minConf) {
    if (!next) return

    const { action, payload } = next

    switch (action) {
      case 'UPDATE_ORDER':
        order.status = payload.status
        await order.save()

        await AuditLog.create({
          orderId: order.orderId,
          orderStatus: order.status,
          extra: {
            asset,
            minConf,
            key,
            txHash
          },
          context: 'VERIFY_TX'
        })
        break
    }
  } else if (currentBlock < (startBlock + maxBlocks)) {
    const when = 'in ' + config.assets[asset].blockTime
    job.schedule(when)
    await job.save()
  } else {
    throw new Error(`${key} from order ${order.orderId} is still pending after ${maxBlocks}`)
  }
}
