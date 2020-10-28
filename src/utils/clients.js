const Client = require('@liquality/client')
const config = require('../config')

const BitcoinRpcProvider = require('@liquality/bitcoin-rpc-provider')
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider')
const BitcoinNodeWalletProvider = require('@liquality/bitcoin-node-wallet-provider')
const BitcoinJsWalletProvider = require('@liquality/bitcoin-js-wallet-provider')
const BitcoinEsploraApiProvider = require('@liquality/bitcoin-esplora-api-provider')
const BitcoinEsploraSwapFindProvider = require('@liquality/bitcoin-esplora-swap-find-provider')
const BitcoinEarnFeeProvider = require('@liquality/bitcoin-earn-fee-provider')
const BitcoinNetworks = require('@liquality/bitcoin-networks')

const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider')
const EthereumJsWalletProvider = require('@liquality/ethereum-js-wallet-provider')
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider')
const EthereumErc20Provider = require('@liquality/ethereum-erc20-provider')
const EthereumErc20SwapProvider = require('@liquality/ethereum-erc20-swap-provider')
const EthereumNetworks = require('@liquality/ethereum-networks')
const EthereumScraperSwapFindProvider = require('@liquality/ethereum-scraper-swap-find-provider')
const EthereumErc20ScraperSwapFindProvider = require('@liquality/ethereum-erc20-scraper-swap-find-provider')
const EthereumGasStationFeeProvider = require('@liquality/ethereum-gas-station-fee-provider')

function createBtcClient (asset) {
  const btcConfig = config.assets.BTC

  if (btcConfig.addressType === 'p2sh-segwit') {
    throw new Error('Wrapped segwit addresses (p2sh-segwit) are currently unsupported.')
  }

  const btcClient = new Client()
  if (btcConfig.wallet && btcConfig.wallet.type === 'js') {
    btcClient.addProvider(new BitcoinEsploraApiProvider(btcConfig.api.url, BitcoinNetworks[btcConfig.network], btcConfig.feeNumberOfBlocks))
    btcClient.addProvider(new BitcoinJsWalletProvider(BitcoinNetworks[btcConfig.network], btcConfig.wallet.mnemonic))
  } else {
    btcClient.addProvider(new BitcoinRpcProvider(btcConfig.rpc.url, btcConfig.rpc.username, btcConfig.rpc.password, btcConfig.feeNumberOfBlocks))
    btcClient.addProvider(new BitcoinNodeWalletProvider(BitcoinNetworks[btcConfig.network], btcConfig.rpc.url, btcConfig.rpc.username, btcConfig.rpc.password, btcConfig.addressType))
  }

  btcClient.addProvider(new BitcoinSwapProvider(BitcoinNetworks[btcConfig.network], btcConfig.swapMode))

  if (btcConfig.wallet && btcConfig.wallet.type === 'js') { // Override swap finding with esplora
    btcClient.addProvider(new BitcoinEsploraSwapFindProvider(btcConfig.api.url))
  }

  btcClient.addProvider(new BitcoinEarnFeeProvider())

  return btcClient
}

function createEthClient (asset, wallet) {
  const ethConfig = config.assets.ETH
  const ethClient = new Client()

  ethClient.addProvider(new EthereumRpcProvider(ethConfig.rpc.url))

  if (ethConfig.wallet && ethConfig.wallet.type === 'js') {
    ethClient.addProvider(new EthereumJsWalletProvider(
      EthereumNetworks[ethConfig.network], ethConfig.wallet.mnemonic
    ))
  }

  ethClient.addProvider(new EthereumSwapProvider())
  ethClient.addProvider(new EthereumScraperSwapFindProvider(ethConfig.scraper.url))
  ethClient.addProvider(new EthereumGasStationFeeProvider())

  return ethClient
}

function createERC20Client (asset) {
  const assetConfig = config.assets[asset]
  const erc20Client = new Client()

  erc20Client.addProvider(new EthereumRpcProvider(assetConfig.rpc.url))

  if (assetConfig.wallet && assetConfig.wallet.type === 'js') {
    erc20Client.addProvider(new EthereumJsWalletProvider(
      EthereumNetworks[assetConfig.network], assetConfig.wallet.mnemonic
    ))
  }

  erc20Client.addProvider(new EthereumErc20Provider(assetConfig.contractAddress))
  erc20Client.addProvider(new EthereumErc20SwapProvider())
  erc20Client.addProvider(new EthereumErc20ScraperSwapFindProvider(assetConfig.scraper.url))
  erc20Client.addProvider(new EthereumGasStationFeeProvider())

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
