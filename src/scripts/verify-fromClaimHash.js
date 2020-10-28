const mongoose = require('mongoose')
const config = require('../config')

const mongooseOnError = err => {
  console.error(err)
  process.exit(1)
}

mongoose
  .connect(config.database.uri, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
  })
  .catch(mongooseOnError)

const Bluebird = require('bluebird')
const Order = require('../models/Order')

async function main () {
  const orders = await Order.find({
    status: 'AGENT_CLAIMED'
  }).sort('-createdAt').exec()

  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const log = message => console.log(`[${++index}/${total}] [${order.from}-${order.to}] ${order.orderId} - ${message}`)
    const fromClient = order.fromClient()

    const fromClaimTx = await fromClient.swap.findClaimSwapTransaction(
      order.fromFundHash,
      order.fromCounterPartyAddress,
      order.fromAddress,
      order.secretHash,
      order.swapExpiration
    )

    if (!fromClaimTx) {
      log('Not claimed yet')
      return
    }

    const fromClaimHash = fromClaimTx.hash

    if (order.fromClaimHash === fromClaimHash) {
      log('Verified')
      return
    }

    log(`Mismatch - On Record ${order.fromClaimHash} vs On Chain ${fromClaimHash}`)

    order.fromClaimHash = fromClaimHash
    await order.save()

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 1000))
    }
  }, { concurrency: 1 })

  console.log('Done')
  process.exit(0)
}

main()
