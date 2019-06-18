const { Client, providers } = require('@liquality/bundle')

module.exports = ({
  btcRpc,
  btcRpcUser,
  btcRpcPass,
  ethRpc,
  ethRpcUser,
  ethRpcPass
}) => {
  const btc = new Client()
  btc.addProvider(new providers.bitcoin.BitcoinBitcoreRpcProvider(btcRpc, btcRpcUser, btcRpcPass))
  btc.addProvider(new providers.bitcoin.BitcoinBitcoinJsLibSwapProvider({ network: providers.bitcoin.networks['bitcoin_testnet'] }))

  const eth = new Client()
  eth.addProvider(new providers.ethereum.EthereumRpcProvider(ethRpc, ethRpcUser, ethRpcPass))
  eth.addProvider(new providers.ethereum.EthereumSwapProvider())

  return {
    btc,
    eth
  }
}
