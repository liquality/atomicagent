const mongoose = require('mongoose')
const Agenda = require('agenda')

const agenda = new Agenda({ mongo: mongoose.connection })

const fx = require('../utils/fx')
const Order = require('../models/Order')

agenda.define('verify-user-init-tx', async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ _id: data.orderId }).exec()
  if (!order) return done()

  // TODO: remove wait() from CAL
  order.status = 'AGENT_PENDING'
  await order.save()

  await order.fromClient().swap.verifyInitiateSwapTransaction(
    order.fromFundHash,
    order.amount,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secretHash,
    order.swapExpiration
  )
  console.log('Found & verified funding transaction', order.id)

  order.status = 'USER_FUNDED'
  await order.save()
  await agenda.now('reciprocate-init-swap', { orderId: order.id })

  done()
})

agenda.define('reciprocate-init-swap', async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ _id: data.orderId }).exec()
  if (!order) return done()

  const toAmount = fx(order.from, order.amount, order.to, order.rate).toNumber()
  const nodeExp = order.swapExpiration - (60 * 60 * 6)

  const tx = await order.toClient().swap.initiateSwap(toAmount, order.toAddress, order.toCounterPartyAddress, order.secretHash, nodeExp)
  console.log('Initiated funding transaction', order.id, tx)

  order.toFundHash = tx
  order.status = 'AGENT_FUNDED'
  await order.save()
  await agenda.now('find-claim-swap-tx', { orderId: order.id })

  done()
})

agenda.define('find-claim-swap-tx', async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ _id: data.orderId }).exec()
  if (!order) return done()

  const nodeExp = order.swapExpiration - (60 * 60 * 6)

  // TODO: remove wait() from CAL
  const claimTx = await order.toClient().swap.findClaimSwapTransaction(
    order.toFundHash,
    order.toAddress,
    order.toCounterPartyAddress,
    order.secretHash,
    nodeExp
  )

  order.secret = claimTx.secret
  order.status = 'USER_CLAIMED'
  await order.save()
  await agenda.now('agent-claim', { orderId: order.id })

  done()
})

agenda.define('agent-claim', async (job, done) => {
  const { data } = job.attrs

  const order = await Order.findOne({ _id: data.orderId }).exec()
  if (!order) return done()

  // TODO: remove wait() from CAL
  await order.fromClient().swap.verifyInitiateSwapTransaction(
    order.fromFundHash,
    order.fromCounterPartyAddress,
    order.fromAddress,
    order.secret,
    order.swapExpiration
  )
  console.log('Node has claimed the swap', order.id)

  order.status = 'AGENT_CLAIMED'
  await order.save()

  done()
})

async function start () {
  await agenda.start()
}

async function stop () {
  await agenda.stop()
  process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
