const Client = require('@liquality/client').default
const cryptoassets = require('@liquality/cryptoassets').default
const config = require('../config')

const BitcoinRpcProvider = require('@liquality/bitcoin-rpc-provider').default
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider').default
const BitcoinNodeWalletProvider = require('@liquality/bitcoin-node-wallet-provider').default
const BitcoinJsWalletProvider = require('@liquality/bitcoin-js-wallet-provider').default
const BitcoinEsploraBatchApiProvider = require('@liquality/bitcoin-esplora-batch-api-provider').default
const BitcoinEsploraSwapFindProvider = require('@liquality/bitcoin-esplora-swap-find-provider').default
const BitcoinEarnFeeProvider = require('@liquality/bitcoin-earn-fee-provider').default
const BitcoinRpcFeeProvider = require('@liquality/bitcoin-rpc-fee-provider').default
const BitcoinNetworks = require('@liquality/bitcoin-networks').default

const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider').default
const EthereumJsWalletProvider = require('@liquality/ethereum-js-wallet-provider').default
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider').default
const EthereumErc20Provider = require('@liquality/ethereum-erc20-provider').default
const EthereumErc20SwapProvider = require('@liquality/ethereum-erc20-swap-provider').default
const EthereumNetworks = require('@liquality/ethereum-networks').default
const EthereumScraperSwapFindProvider = require('@liquality/ethereum-scraper-swap-find-provider').default
const EthereumErc20ScraperSwapFindProvider = require('@liquality/ethereum-erc20-scraper-swap-find-provider').default
const EthereumGasNowFeeProvider = require('@liquality/ethereum-gas-now-fee-provider').default
const EthereumRpcFeeProvider = require('@liquality/ethereum-rpc-fee-provider')

const NearSwapProvider = require('@liquality/near-swap-provider').default
const NearJsWalletProvider = require('@liquality/near-js-wallet-provider').default
const NearRpcProvider = require('@liquality/near-rpc-provider').default
const NearSwapFindProvider = require('@liquality/near-swap-find-provider').default
const NearNetworks = require('@liquality/near-networks').default

function createBtcClient () {
  const btcConfig = config.assets.BTC
  const network = BitcoinNetworks[btcConfig.network]

  if (btcConfig.addressType === 'p2sh-segwit') {
    throw new Error('Wrapped segwit addresses (p2sh-segwit) are currently unsupported.')
  }

  const btcClient = new Client()
  if (btcConfig.wallet && btcConfig.wallet.type === 'js') {
    btcClient.addProvider(new BitcoinEsploraBatchApiProvider(
      {
        batchUrl: btcConfig.batchApi.url,
        url: btcConfig.api.url,
        network: network,
        numberOfBlockConfirmation: btcConfig.feeNumberOfBlocks

      }
    ))
    btcClient.addProvider(new BitcoinJsWalletProvider({ network: network, mnemonic: btcConfig.wallet.mnemonic }))
  } else {
    btcClient.addProvider(new BitcoinRpcProvider({ uri: btcConfig.rpc.url, username: btcConfig.rpc.username, password: btcConfig.rpc.password, network: network, feeBlockConfirmations: btcConfig.feeNumberOfBlocks }))
    btcClient.addProvider(new BitcoinNodeWalletProvider({ network: network, uri: btcConfig.rpc.url, username: btcConfig.rpc.username, password: btcConfig.rpc.password, addressType: btcConfig.addressType }))
  }

  btcClient.addProvider(new BitcoinSwapProvider({ network: network, mode: btcConfig.swapMode }))

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

  ethClient.addProvider(new EthereumRpcProvider({ uri: ethConfig.rpc.url }))

  if (ethConfig.wallet && ethConfig.wallet.type === 'js') {
    ethClient.addProvider(new EthereumJsWalletProvider(
      network, ethConfig.wallet.mnemonic
    ))
  }

  ethClient.addProvider(new EthereumSwapProvider())
  ethClient.addProvider(new EthereumScraperSwapFindProvider(ethConfig.scraper.url))

  if (network.isTestnet || asset === 'RBTC' || asset === 'BNB') {
    ethClient.addProvider(new EthereumRpcFeeProvider())
  } else {
    ethClient.addProvider(new EthereumGasNowFeeProvider())
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

  erc20Client.addProvider(new EthereumRpcProvider({ uri: assetConfig.rpc.url }))

  if (assetConfig.wallet && assetConfig.wallet.type === 'js') {
    erc20Client.addProvider(new EthereumJsWalletProvider(
      network, assetConfig.wallet.mnemonic
    ))
  }

  erc20Client.addProvider(new EthereumErc20Provider(assetConfig.contractAddress))
  erc20Client.addProvider(new EthereumErc20SwapProvider())
  erc20Client.addProvider(new EthereumErc20ScraperSwapFindProvider(assetConfig.scraper.url))

  if (network.isTestnet || asset === 'RBTC' || asset === 'BNB') {
    erc20Client.addProvider(new EthereumRpcFeeProvider())
  } else {
    erc20Client.addProvider(new EthereumGasNowFeeProvider())
  }

  return erc20Client
}

function createNearClient() {
  const nearConfig = config.assets.NEAR
  const network = NearNetworks[nearConfig.network]

  const nearClient = new Client()
  if (nearConfig.wallet && nearConfig.wallet.type === 'js') {
    nearClient.addProvider(new NearJsWalletProvider(network, nearConfig.wallet.mnemonic))
  }

  nearClient.addProvider(new NearSwapProvider())
  nearClient.addProvider(new NearSwapFindProvider(network.helperUrl))
  nearClient.addProvider(new NearRpcProvider(network))

  return nearClient
}

const clientCreators = {
  BTC: createBtcClient,
  ETH: createEthClient,
  RBTC: createEthClient,
  BNB: createEthClient,
  ERC20: createERC20Client,
  NEAR: createNearClient
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
