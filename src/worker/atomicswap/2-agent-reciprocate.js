const debug = require('debug')('liquality:agent:worker:2-agent-reciprocate')

const config = require('../../config')
const Check = require('../../models/Check')
const Order = require('../../models/Order')
const Asset = require('../../models/Asset')

module.exports = async function (order) {
  if (order.status !== 'USER_FUNDED') {
    throw new Error(`Order has invalid status: ${order.orderId} / ${order.status}`)
  }

  const fromClient = await order.fromClient()
  const toClient = await order.toClient()

  const fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
  let fromCurrentBlock

  try {
    fromCurrentBlock = await fromClient.chain.getBlockByNumber(fromCurrentBlockNumber)
  } catch (e) {
    debug(e)

    return {
      next: true
    }
  }

  const stop =
    order.isQuoteExpired() || order.isSwapExpired(fromCurrentBlock) || order.isNodeSwapExpired(fromCurrentBlock)
  if (stop) {
    if (order.isQuoteExpired()) {
      debug(`Order ${order.orderId} expired due to expiresAt`)
      order.status = 'QUOTE_EXPIRED'
    }

    if (order.isSwapExpired(fromCurrentBlock)) {
      debug(`Order ${order.orderId} expired due to swapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    if (order.isNodeSwapExpired(fromCurrentBlock)) {
      debug(`Order ${order.orderId} expired due to nodeSwapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    await order.save()

    await order.log('RECIPROCATE_INIT_SWAP', null, {
      fromBlock: fromCurrentBlockNumber
    })

    return
  }

  const check = await Check.getCheckForOrder(order.orderId)
  const flag = check.get('flags.reciprocate-init-swap') || {}

  if (flag.reject) {
    debug(`Rejected ${order.orderId}`, flag.message)
    return
  }

  // const withinUsdThreshold = order.fromAmountUsd > 0 && order.fromAmountUsd < config.threshold.manualAboveFromAmountUsd
  // if (!withinUsdThreshold) {
  //   if (!flag.approve) {
  //     throw new RescheduleError(`Reschedule ${orderId}: reciprocate-init-swap is not approved yet`, order.from)
  //   }

  //   debug(`Approved ${orderId}`, flag.message)
  // }

  const fromAsset = await Asset.findOne({ code: order.from }).exec()
  if (fromAsset['24hrUsdLimit']) {
    const yesterday = Date.now() - 1000 * 60 * 60 * 24
    const query = await Order.aggregate([
      {
        $match: {
          from: order.from,
          status: { $nin: ['QUOTE', 'QUOTE_EXPIRED'] },
          createdAt: { $gte: new Date(yesterday) }
        }
      },
      {
        $group: {
          _id: null,
          'sum:fromAmountUsd': { $sum: '$fromAmountUsd' }
        }
      }
    ]).exec()
    const fromAmountDaily = query[0]['sum:fromAmountUsd']
    if (fromAmountDaily > fromAsset['24hrUsdLimit']) {
      if (!flag.approve) {
        debug(`Reschedule ${order.orderId}: reciprocate-init-swap is not approved yet`)

        return {
          next: true
        }
      }
      debug(`Approved ${order.orderId}`, flag.message)
    }
  }

  const type = 'reciprocate-init-swap'
  const action = 'approve'
  const message = `${order.fromAmountUsd} < ${config.threshold.manualAboveFromAmountUsd}`

  check.set(`flags.${type}`, {
    [action]: new Date(),
    message
  })

  await check.save()

  await order.log('AUTH', 'AUTO_APPROVED', { type, action, message })

  debug(`Auto-approved order ${order.orderId} worth $${order.fromAmountUsd}`)

  let toLastScannedBlock

  try {
    toLastScannedBlock = await toClient.chain.getBlockHeight()
  } catch (e) {
    debug(e)

    return {
      next: true
    }
  }

  const toFundTx = await order.initiateSwap()

  debug('Created contract/funded with transaction', order.orderId, toFundTx.hash)

  order.addTx('toFundHash', toFundTx)
  order.status = 'AGENT_CONTRACT_CREATED'
  await order.save()

  await order.log('RECIPROCATE_INIT_SWAP', null, {
    toLastScannedBlock: toLastScannedBlock,
    toFundHash: toFundTx.hash,
    toSecondaryFundHash: order.toSecondaryFundHash
  })

  return {
    next: true,
    verify: 'toFundHash'
  }
}
