const Client = require('@liquality/client')
const config = require('../config')

const BitcoinRpcProvider = require('@liquality/bitcoin-rpc-provider')
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider')
const BitcoinNodeWalletProvider = require('@liquality/bitcoin-node-wallet-provider')
const BitcoinNetworks = require('@liquality/bitcoin-networks')

const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider')
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider')
const EthereumErc20Provider = require('@liquality/ethereum-erc20-provider')
const EthereumErc20SwapProvider = require('@liquality/ethereum-erc20-swap-provider')

function createBtcClient (asset) {
  const btcConfig = config.assets.BTC

  if (btcConfig.addressType === 'p2sh-segwit') {
    throw new Error('Wrapped segwit addresses (p2sh-segwit) are currently unsupported.')
  }

  const btcClient = new Client()
  btcClient.addProvider(new BitcoinRpcProvider(btcConfig.rpc.url, btcConfig.rpc.username, btcConfig.rpc.password, btcConfig.feeNumberOfBlocks))
  btcClient.addProvider(new BitcoinNodeWalletProvider(BitcoinNetworks[btcConfig.network], btcConfig.rpc.url, btcConfig.rpc.username, btcConfig.rpc.password, btcConfig.addressType))
  btcClient.addProvider(new BitcoinSwapProvider({ network: BitcoinNetworks[btcConfig.network] }, btcConfig.swapMode))
  return btcClient
}

function createEthClient (asset, wallet) {
  const ethConfig = config.assets.ETH
  const ethClient = new Client()
  ethClient.addProvider(new EthereumRpcProvider(
    ethConfig.rpc.url
  ))
  ethClient.addProvider(new EthereumSwapProvider())
  return ethClient
}

function createERC20Client (asset) {
  const assetConfig = config.assets[asset]
  const erc20Client = new Client()
  erc20Client.addProvider(new EthereumRpcProvider(
    assetConfig.rpc.url
  ))
  erc20Client.addProvider(new EthereumErc20Provider(assetConfig.contractAddress))
  erc20Client.addProvider(new EthereumErc20SwapProvider())
  return erc20Client
}

const clientCreators = {
  BTC: createBtcClient,
  ETH: createEthClient,
  ERC20: createERC20Client
}

const clients = {}

function getClient (asset) {
  if (asset in clients) return clients[asset]
  const assetConfig = config.assets[asset]
  const creator = clientCreators[asset] || clientCreators[assetConfig.type]
  const client = creator(asset)
  clients[asset] = client
  return client
}

module.exports = { getClient }
