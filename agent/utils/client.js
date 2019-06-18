const Client = require('@liquality/client')

const BitcoinBitcoreRpcProvider = require('@liquality/bitcoin-bitcore-rpc-provider')
const BitcoinBitcoinJsLibSwapProvider = require('@liquality/bitcoin-bitcoinjs-lib-swap-provider')
const BitcoinNetworks = require('@liquality/bitcoin-networks')

const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider')
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider')

module.exports = ({
  btcRpc,
  btcRpcUser,
  btcRpcPass,
  ethRpc,
  ethRpcUser,
  ethRpcPass
}) => {
  const btc = new Client()
  btc.addProvider(new BitcoinBitcoreRpcProvider(btcRpc, btcRpcUser, btcRpcPass))
  btc.addProvider(new BitcoinBitcoinJsLibSwapProvider({ network: BitcoinNetworks['bitcoin_testnet'] }))

  const eth = new Client()
  eth.addProvider(new EthereumRpcProvider(ethRpc, ethRpcUser, ethRpcPass))
  eth.addProvider(new EthereumSwapProvider())

  return {
    btc,
    eth
  }
}
