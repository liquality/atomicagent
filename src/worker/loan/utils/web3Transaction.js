const web3 = require('../../../utils/web3')
const EthTransaction = require('../../../models/EthTransaction')

async function setTxParams (data, from, to) {
  const txParams = { data, from, to }

  const [nonce, gasPrice, gasLimit] = await Promise.all([
    web3().eth.getTransactionCount(from),
    web3().eth.getGasPrice(),
    web3().eth.estimateGas(txParams)
  ])

  txParams.nonce = nonce
  txParams.gasPrice = gasPrice
  txParams.gasLimit = gasLimit + 1000000

  const ethTransaction = EthTransaction.fromTxParams(txParams)
  await ethTransaction.save()

  return { txParams, ethTransaction }
}

module.exports = {
  setTxParams
}
