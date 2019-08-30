const Client = require('@liquality/client')

const BitcoinRpcProvider = require('@liquality/bitcoin-rpc-provider')
const BitcoinNodeWalletProvider = require('@liquality/bitcoin-node-wallet-provider')
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider')
const BitcoinNetworks = require('@liquality/bitcoin-networks')

const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider')
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider')

const BTC = new Client()
BTC.addProvider(new BitcoinRpcProvider('http://localhost:18443/', 'bitcoin', 'local321'))
BTC.addProvider(new BitcoinNodeWalletProvider(BitcoinNetworks['bitcoin_regtest'], 'http://localhost:18443/', 'bitcoin', 'local321'))
BTC.addProvider(new BitcoinSwapProvider({ network: BitcoinNetworks['bitcoin_regtest'] }))

const ETH = new Client()
ETH.addProvider(new EthereumRpcProvider('http://localhost:8545/'))
ETH.addProvider(new EthereumSwapProvider())

module.exports = {
  BTC,
  ETH
}
