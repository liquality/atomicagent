const Client = require('@liquality/client')

const BitcoinBitcoreRpcProvider = require('@liquality/bitcoin-bitcore-rpc-provider')
const BitcoinBitcoinJsLibSwapProvider = require('@liquality/bitcoin-bitcoinjs-lib-swap-provider')
const BitcoinNetworks = require('@liquality/bitcoin-networks')

const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider')
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider')

const BTC = new Client()
BTC.addProvider(new BitcoinBitcoreRpcProvider('http://localhost:4321/bitcoind/', 'bitcoin', 'local321'))
BTC.addProvider(new BitcoinBitcoinJsLibSwapProvider({ network: BitcoinNetworks['bitcoin_testnet'] }))

const ETH = new Client()
ETH.addProvider(new EthereumRpcProvider('http://localhost:4321/parity/'))
ETH.addProvider(new EthereumSwapProvider())

module.exports = {
  BTC,
  ETH
}
