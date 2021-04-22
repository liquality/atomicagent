const Client = require('@liquality/client')
const { assets: cryptoassets } = require('@liquality/cryptoassets')
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
const EthereumGasNowFeeProvider = require('@liquality/ethereum-gas-now-fee-provider')
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
  const assetData = cryptoassets[asset]
  const assetConfig = config.assets[asset]

  let network = EthereumNetworks[assetConfig.network]
  if (network.name === 'local') {
    network = {
      ...network,
      name: 'mainnet',
      chainId: 1337,
      networkId: 1337
    }
  }

  const ethClient = new Client()
  ethClient.addProvider(new EthereumRpcProvider(assetConfig.rpc.url))
  ethClient.addProvider(new EthereumJsWalletProvider(network, assetConfig.wallet.mnemonic))

  if (assetData.type === 'erc20') {
    const contractAddress = assetConfig.contractAddress
    ethClient.addProvider(new EthereumErc20Provider(contractAddress))
    ethClient.addProvider(new EthereumErc20SwapProvider())
    ethClient.addProvider(new EthereumErc20ScraperSwapFindProvider(assetConfig.scraper.url))
  } else {
    ethClient.addProvider(new EthereumSwapProvider())
    ethClient.addProvider(new EthereumScraperSwapFindProvider(assetConfig.scraper.url))
  }

  const FeeProvider = assetData.chain === 'ethereum' && !network.isTestnet
    ? EthereumGasNowFeeProvider
    : EthereumRpcFeeProvider
  ethClient.addProvider(new FeeProvider())

  return ethClient
}

const clients = {}

function createClient (asset) {
  const assetData = cryptoassets[asset]

  if (assetData.chain === 'bitcoin') return createBtcClient()
  if (assetData.chain === 'rsk') return createEthClient(asset)
  if (assetData.chain === 'bsc') return createEthClient(asset)
  if (assetData.chain === 'ethereum') return createEthClient(asset)

  throw new Error(`Could not create client for asset ${asset}`)
}

function getClient (asset) {
  if (asset in clients) return clients[asset]
  const client = createClient(asset)
  clients[asset] = client
  return client
}

module.exports = { getClient }
