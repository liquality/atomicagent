const Client = require('@liquality/client')
const cryptoassets = require('@liquality/cryptoassets').default
const config = require('../config')

const BitcoinRpcProvider = require('@liquality/bitcoin-rpc-provider')
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider')
const BitcoinNodeWalletProvider = require('@liquality/bitcoin-node-wallet-provider')
const BitcoinJsWalletProvider = require('@liquality/bitcoin-js-wallet-provider')
const BitcoinEsploraBatchApiProvider = require('@liquality/bitcoin-esplora-batch-api-provider')
const BitcoinEsploraSwapFindProvider = require('@liquality/bitcoin-esplora-swap-find-provider')
const BitcoinEarnFeeProvider = require('@liquality/bitcoin-earn-fee-provider')
const BitcoinRpcFeeProvider = require('@liquality/bitcoin-rpc-fee-provider')
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
const EthereumRpcFeeProvider = require('@liquality/ethereum-rpc-fee-provider')

function createBtcClient () {
  const btcConfig = config.assets.BTC
  const network = BitcoinNetworks[btcConfig.network]

  if (btcConfig.addressType === 'p2sh-segwit') {
    throw new Error('Wrapped segwit addresses (p2sh-segwit) are currently unsupported.')
  }

  const btcClient = new Client()
  if (btcConfig.wallet && btcConfig.wallet.type === 'js') {
    btcClient.addProvider(new BitcoinEsploraBatchApiProvider(btcConfig.batchApi.url, btcConfig.api.url, network, btcConfig.feeNumberOfBlocks))
    btcClient.addProvider(new BitcoinJsWalletProvider(network, btcConfig.wallet.mnemonic))
  } else {
    btcClient.addProvider(new BitcoinRpcProvider(btcConfig.rpc.url, btcConfig.rpc.username, btcConfig.rpc.password, btcConfig.feeNumberOfBlocks))
    btcClient.addProvider(new BitcoinNodeWalletProvider(network, btcConfig.rpc.url, btcConfig.rpc.username, btcConfig.rpc.password, btcConfig.addressType))
  }

  btcClient.addProvider(new BitcoinSwapProvider(network, btcConfig.swapMode))

  if (btcConfig.wallet && btcConfig.wallet.type === 'js') { // Override swap finding with esplora
    btcClient.addProvider(new BitcoinEsploraSwapFindProvider(btcConfig.api.url))
  }

  if (network.isTestnet) {
    btcClient.addProvider(new BitcoinRpcFeeProvider())
  } else {
    btcClient.addProvider(new BitcoinEarnFeeProvider('https://liquality.io/swap/mempool/v1/fees/recommended'))
  }

  return btcClient
}

function createEthClient (asset) {
  const ethConfig = config.assets[asset]
  const ethClient = new Client()

  let network = EthereumNetworks[ethConfig.network]
  if (network.name === 'local') {
    network = {
      ...network,
      name: 'mainnet',
      chainId: 1337,
      networkId: 1337
    }
  }

  ethClient.addProvider(new EthereumRpcProvider(ethConfig.rpc.url))

  if (ethConfig.wallet && ethConfig.wallet.type === 'js') {
    ethClient.addProvider(new EthereumJsWalletProvider(
      network, ethConfig.wallet.mnemonic
    ))
  }

  ethClient.addProvider(new EthereumSwapProvider())
  ethClient.addProvider(new EthereumScraperSwapFindProvider(ethConfig.scraper.url))

  if (network.isTestnet) {
    ethClient.addProvider(new EthereumRpcFeeProvider())
  } else {
    ethClient.addProvider(new EthereumGasStationFeeProvider())
  }

  return ethClient
}

function createERC20Client (asset) {
  const assetConfig = config.assets[asset]
  const erc20Client = new Client()

  let network = EthereumNetworks[assetConfig.network]
  if (network.name === 'local') {
    network = {
      ...network,
      name: 'mainnet',
      chainId: 1337,
      networkId: 1337
    }
  }

  erc20Client.addProvider(new EthereumRpcProvider(assetConfig.rpc.url))

  if (assetConfig.wallet && assetConfig.wallet.type === 'js') {
    erc20Client.addProvider(new EthereumJsWalletProvider(
      network, assetConfig.wallet.mnemonic
    ))
  }

  erc20Client.addProvider(new EthereumErc20Provider(assetConfig.contractAddress))
  erc20Client.addProvider(new EthereumErc20SwapProvider())
  erc20Client.addProvider(new EthereumErc20ScraperSwapFindProvider(assetConfig.scraper.url))

  if (network.isTestnet) {
    erc20Client.addProvider(new EthereumRpcFeeProvider())
  } else {
    erc20Client.addProvider(new EthereumGasStationFeeProvider())
  }

  return erc20Client
}

const clientCreators = {
  BTC: createBtcClient,
  ETH: createEthClient,
  RBTC: createEthClient,
  ERC20: createERC20Client
}

const clients = {}

function getClient (asset) {
  if (asset in clients) return clients[asset]
  const type = cryptoassets[asset].type === 'erc20'
    ? 'ERC20'
    : asset
  const creator = clientCreators[type]
  const client = creator(asset)
  clients[asset] = client
  return client
}

module.exports = { getClient }
