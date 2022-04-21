const debug = require('debug')('liquality:agent:worker:3-agent-fund')

module.exports = async function (order) {
  if (order.status !== 'AGENT_CONTRACT_CREATED') {
    throw new Error(`Order has invalid status: ${order.orderId} / ${order.status}`)
  }

  const fromClient = await order.fromClient()

  let fromCurrentBlockNumber
  let fromCurrentBlock

  try {
    fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
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

    await order.log('FUND_SWAP', null, {
      fromBlock: fromCurrentBlockNumber
    })

    debug(`Stopping ${order.orderId} - ${order.status}`)

    return
  }

  const toSecondaryFundTx = await order.fundSwap()
  if (toSecondaryFundTx) {
    debug('Initiated secondary funding transaction', order.orderId, toSecondaryFundTx.hash)
    order.addTx('toSecondaryFundHash', toSecondaryFundTx)
  }

  order.status = 'AGENT_FUNDED'
  await order.save()

  const retVal = []

  if (toSecondaryFundTx) {
    retVal.verify = 'toSecondaryFundHash'
  }

  await order.log('FUND_SWAP', null, {
    toSecondaryFundHash: order.toSecondaryFundHash
  })

  retVal.next = true

  return retVal
}
