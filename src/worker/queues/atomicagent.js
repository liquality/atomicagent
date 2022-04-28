require('../../utils/sentry')
const mongo = require('../../utils/mongo')
const debug = require('debug')('liquality:agent:worker:atomicagent')

const Order = require('../../models/Order')

const verifyUserInit = require('../atomicswap/1-verify-user-init')
const agentReciprocate = require('../atomicswap/2-agent-reciprocate')
const agentFund = require('../atomicswap/3-agent-fund')
const fundUserClaimOrAgentRefund = require('../atomicswap/4-find-user-claim-or-agent-refund')
const agentClaim = require('../atomicswap/5-agent-claim')

async function process(job) {
  debug(job.data)

  const { orderId } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }

  let fn

  switch (order.status) {
    case 'USER_FUNDED_UNVERIFIED':
      fn = verifyUserInit
      break
    case 'USER_FUNDED':
      fn = agentReciprocate
      break
    case 'AGENT_CONTRACT_CREATED':
      fn = agentFund
      break
    case 'AGENT_FUNDED':
      fn = fundUserClaimOrAgentRefund
      break
    case 'USER_CLAIMED':
      fn = agentClaim
      break
    default:
      throw new Error(`Invalid order status: "${order.status}"`)
  }

  try {
    const result = await fn(order, job)
    if (!result) return

    const retVal = {}

    if (result.next) {
      retVal.atomicAgent = job.data
    }

    if (result.verify) {
      retVal.verify = {
        orderId,
        type: result.verify
      }
    }

    return retVal
  } catch (e) {
    if (e.name === 'RescheduleError') {
      return {
        atomicAgent: job.data
      }
    }

    throw e
  }
}

module.exports.addJobToQueue = process

module.exports = (job) => {
  return mongo
    .connect()
    .then(() => process(job))
    .finally(() => mongo.disconnect())
}
