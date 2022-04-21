const debug = require('debug')('liquality:agent:worker:5-agent-claim')

module.exports = async function (order) {
  if (order.status !== 'USER_CLAIMED') {
    throw new Error(`Order has invalid status: ${order.orderId} / ${order.status}`)
  }

  const fromClaimTx = await order.claimSwap()

  debug('Node has claimed the swap', order.orderId, fromClaimTx.hash)

  order.addTx('fromClaimHash', fromClaimTx)
  order.status = 'AGENT_CLAIMED'
  await order.save()

  await order.log('AGENT_CLAIM', null, {
    fromClaimHash: fromClaimTx.hash
  })

  return {
    verify: 'fromClaimHash'
  }
}
