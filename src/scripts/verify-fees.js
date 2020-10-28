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

const getTotalFee = async (asset, client, hash, address, amount) => {
  const fromFundTx = await client.chain.getTransactionByHash(hash)
  if (!fromFundTx) return 0
  if (['BTC', 'ETH'].includes(asset)) return fromFundTx.fee
  if (!address) return fromFundTx.fee

  const initiationTransactionReceipt = await client.getMethod('getTransactionReceipt')(fromFundTx.hash)
  const erc20ContractAddress = await client.getMethod('getContractAddress')()

  const contractData = await client.getMethod('generateErc20Transfer')(initiationTransactionReceipt.contractAddress, amount)
  const partialErc20FundingTx = await client.getMethod('findAddressTransaction')(address, tx => {
    return tx.blockNumber >= fromFundTx.blockNumber &&
           tx._raw.to === erc20ContractAddress &&
           tx._raw.input === contractData
  })

  if (!partialErc20FundingTx) {
    console.log('ERC20 Funding Transaction Not Found', hash)
    return fromFundTx.fee
  }

  const erc20FundingTx = await client.chain.getTransactionByHash(partialErc20FundingTx.hash)
  return erc20FundingTx.fee + fromFundTx.fee
}

async function main () {
  const orders = await Order.find({
    status: {
      $ne: 'QUOTE'
    }
  }).sort('-createdAt').exec()

  const total = orders.length
  console.log('Total Orders', total)
  let index = 0

  await Bluebird.map(orders, async order => {
    const log = message => console.log(`[${++index}/${total}] [${order.from}-${order.to}] ${order.orderId} - ${message}`)
    const fromClient = order.fromClient()
    const toClient = order.toClient()

    const update = {}
    const batch = []

    if (order.fromFundHash) {
      batch.push(getTotalFee(order.from, fromClient, order.fromFundHash, order.fromAddress, order.fromAmount)
        .then(fee => (update.fromFundTxFee = fee))
        .catch(e => console.error(order.orderId, e)))
    }

    if (order.fromClaimHash) {
      batch.push(getTotalFee(order.from, fromClient, order.fromClaimHash)
        .then(fee => (update.fromClaimTxFee = fee))
        .catch(e => console.error(order.orderId, e)))
    }

    if (order.toFundHash) {
      batch.push(getTotalFee(order.to, toClient, order.toFundHash, order.toCounterPartyAddress, order.toAmount)
        .then(fee => (update.toFundTxFee = fee))
        .catch(e => console.error(order.orderId, e)))
    }

    if (order.toClaimHash) {
      batch.push(getTotalFee(order.to, toClient, order.toClaimHash)
        .then(fee => (update.toClaimTxFee = fee))
        .catch(e => console.error(order.orderId, e)))
    }

    if (order.toRefundHash) {
      batch.push(getTotalFee(order.to, toClient, order.toRefundHash)
        .then(fee => (update.toRefundTxFee = fee))
        .catch(e => console.error(order.orderId, e)))
    }

    await Promise.all(batch)

    Object
      .entries(update)
      .forEach(([key, value]) => (order[key] = value))

    await order.save()

    log('Updated')

    if (Math.random() < 0.5) {
      await new Promise((resolve, reject) => setTimeout(resolve, 500))
    }
  }, { concurrency: 5 })

  console.log('Done')
  process.exit(0)
}

main()
