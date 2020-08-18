// require('mongoose').connect('mongodb://localhost/liquality_mainnet', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })

// const Bluebird = require('bluebird')
const { getClient } = require('./src/utils/clients')

async function main () {
  const fromClient = getClient('DAI')
  const toClient = getClient('ETH')

  // console.log(await toClient.chain.getTransactionByHash('03f7bf8df015bdd5c189e7c17f70376000cc862aebb487559b8ba00835a9a6bd'))

  // for (var i = 0; i < 5; i++) {
  //   const confirmedNonce = await toClient.getMethod('getTransactionCount')('0x3a712CC47aeb0F20A7C9dE157c05d74B11F172f5')
  //   const pendingNonce = await toClient.getMethod('getTransactionCount')('0x3a712CC47aeb0F20A7C9dE157c05d74B11F172f5', 'pending')
  //
  //   const diff = pendingNonce - confirmedNonce
  //
  //   console.log('Attempt: #', i + 1)
  //   console.log('Confirmed Nonce:', confirmedNonce)
  //   console.log('Pending Nonce:', pendingNonce)
  //   console.log('Nonce Diff:', diff)
  //   console.log('---')
  // }

  // initiationTxHash
  // recipientAddress
  // refundAddress
  // secret
  // expiration
  // gasPrice

  console.log(await fromClient.swap.claimSwap(
    '8be033d9840bcae24e7494c170378757c32390b7db7029caa24ccc5c64d4f0fd',
    '0x3a712CC47aeb0F20A7C9dE157c05d74B11F172f5',
    '0x6702358ce1364fe9Ab37e1D7553f3Fbda80Cd193',
    'c029f1a7f3e291390720cd5004f424c5bce1d1c9de0e7d3c1a33e58fd38241cd',
    1597366452,
    300
  ))

  // console.log(
  //   order.toFundHash,
  //   order.toAddress,
  //   order.toCounterPartyAddress,
  //   order.secretHash,
  //   order.nodeSwapExpiration
  // )
  //
  // const claimTx = await toClient.swap.findClaimSwapTransaction(
  //   order.toFundHash,
  //   order.toAddress,
  //   order.toCounterPartyAddress,
  //   order.secretHash,
  //   order.nodeSwapExpiration
  // )
  //
  // console.log(claimTx)
  // // return
  // //
  // // order.secret = claimTx.secret
  // // await order.save()
  //
  // const tx = await fromClient.swap.refundSwap(
  //   order.toFundHash,
  //   order.toAddress,
  //   order.toCounterPartyAddress,
  //   order.secretHash,
  //   order.nodeSwapExpiration
  // )
  //
  // console.log(tx)
}

main()
