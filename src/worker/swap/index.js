const axios = require('axios')
const fx = require('../../utils/fx')
const Market = require('../../models/Market')
const Order = require('../../models/Order')
const BN = require('bignumber.js')

function defineSwapJobs (agenda) {
  agenda.define('verify-user-init-tx', async (job, done) => {
    const { data } = job.attrs

    const order = await Order.findOne({ _id: data.orderId }).exec()
    if (!order) return done()

    order.status = 'AGENT_PENDING'
    await order.save()

    // TODO: remove wait() from CAL
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
    console.log('Found claim transaction', claimTx)

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

    try {
      // TODO: remove wait() from CAL
      await order.fromClient().swap.claimSwap(
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
    } catch (e) {
      console.error(e)
      job.fail(e)
      job.schedule('10 seconds from now')
      await job.save()
    }
  })

  agenda.define('update-market-data', async (job, done) => {
    console.log('Updating market data')

    const markets = await Market.find({ status: 'ACTIVE' }).exec()
    const currencies = Array.from(new Set([].concat(...markets.map(market => [market.from, market.to]))))
    const MAP = {}

    await Promise.all(currencies.map(currency => {
      return axios(`https://api.coinbase.com/v2/prices/${currency}-USD/spot`)
        .then(res => {
          MAP[currency] = res.data.data.amount
        })
    }))

    await Promise.all(markets.map(market => {
      const from = BN(MAP[market.from])
      const to = BN(MAP[market.to])

      market.rate = from.div(to).dp(8)

      console.log(`${market.from}_${market.to}`, market.rate)

      return market.save()
    }))

    done()
  })
}

module.exports = {
  defineSwapJobs
}
