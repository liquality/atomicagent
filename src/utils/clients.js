const { Client } = require('@liquality/client')
const { assets } = require('@liquality/cryptoassets')
const config = require('../config')

const { BitcoinRpcProvider } = require('@liquality/bitcoin-rpc-provider')
const { BitcoinSwapProvider } = require('@liquality/bitcoin-swap-provider')
const { BitcoinNodeWalletProvider } = require('@liquality/bitcoin-node-wallet-provider')
const { BitcoinJsWalletProvider } = require('@liquality/bitcoin-js-wallet-provider')
const { BitcoinEsploraBatchApiProvider } = require('@liquality/bitcoin-esplora-batch-api-provider')
const { BitcoinEsploraSwapFindProvider } = require('@liquality/bitcoin-esplora-swap-find-provider')
const { BitcoinFeeApiProvider } = require('@liquality/bitcoin-fee-api-provider')
const { BitcoinRpcFeeProvider } = require('@liquality/bitcoin-rpc-fee-provider')
const { BitcoinNetworks } = require('@liquality/bitcoin-networks')

const { EthereumRpcProvider } = require('@liquality/ethereum-rpc-provider')
const { EthereumJsWalletProvider } = require('@liquality/ethereum-js-wallet-provider')
const { EthereumSwapProvider } = require('@liquality/ethereum-swap-provider')
const { EthereumErc20Provider } = require('@liquality/ethereum-erc20-provider')
const { EthereumErc20SwapProvider } = require('@liquality/ethereum-erc20-swap-provider')
const { EthereumNetworks } = require('@liquality/ethereum-networks')
const { EthereumScraperSwapFindProvider } = require('@liquality/ethereum-scraper-swap-find-provider')
const { EthereumErc20ScraperSwapFindProvider } = require('@liquality/ethereum-erc20-scraper-swap-find-provider')
const { EthereumGasNowFeeProvider } = require('@liquality/ethereum-gas-now-fee-provider')
const { EthereumRpcFeeProvider } = require('@liquality/ethereum-rpc-fee-provider')

const { NearSwapProvider } = require('@liquality/near-swap-provider')
const { NearJsWalletProvider } = require('@liquality/near-js-wallet-provider')
const { NearRpcProvider } = require('@liquality/near-rpc-provider')
const { NearSwapFindProvider } = require('@liquality/near-swap-find-provider')
const { NearNetworks } = require('@liquality/near-networks')

const { SolanaNetworks } = require('@liquality/solana-networks')
const { SolanaRpcProvider } = require('@liquality/solana-rpc-provider')
const { SolanaWalletProvider } = require('@liquality/solana-wallet-provider')
const { SolanaSwapProvider } = require('@liquality/solana-swap-provider')
const { SolanaSwapFindProvider } = require('@liquality/solana-swap-find-provider')

const { TerraNetworks } = require('@liquality/terra-networks')
const { TerraRpcProvider } = require('@liquality/terra-rpc-provider')
const { TerraWalletProvider } = require('@liquality/terra-wallet-provider')
const { TerraSwapProvider } = require('@liquality/terra-swap-provider')
const { TerraSwapFindProvider } = require('@liquality/terra-swap-find-provider');

function createBtcClient () {
  const btcConfig = config.assets.BTC
  const network = BitcoinNetworks[btcConfig.network]

  if (btcConfig.addressType === 'p2sh-segwit') {
    throw new Error('Wrapped segwit addresses (p2sh-segwit) are currently unsupported.')
  }

  const btcClient = new Client()
  if (btcConfig.wallet && btcConfig.wallet.type === 'js') {
    btcClient.addProvider(new BitcoinEsploraBatchApiProvider({
      batchUrl: btcConfig.batchApi.url,
      url: btcConfig.api.url,
      network: network,
      numberOfBlockConfirmation: btcConfig.feeNumberOfBlocks
    }))
    btcClient.addProvider(new BitcoinJsWalletProvider({ network: network, mnemonic: btcConfig.wallet.mnemonic, baseDerivationPath: `m/84'/${network.coinType}'/0'` }))
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
    btcClient.addProvider(new BitcoinFeeApiProvider('https://liquality.io/swap/mempool/v1/fees/recommended'))
  }

  return btcClient
}

function createEthClient (asset) {
  const assetData = assets[asset]
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
  ethClient.addProvider(new EthereumRpcProvider({ uri: assetConfig.rpc.url }))
  ethClient.addProvider(new EthereumJsWalletProvider({ network, mnemonic: assetConfig.wallet.mnemonic, derivationPath: `m/44'/${network.coinType}'/0'/0/0` }))

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

function createNearClient () {
  const nearConfig = config.assets.NEAR
  const network = NearNetworks[nearConfig.network]

  const nearClient = new Client()
  if (nearConfig.wallet && nearConfig.wallet.type === 'js') {
    nearClient.addProvider(new NearJsWalletProvider({ network, mnemonic: nearConfig.wallet.mnemonic, derivationPath: `m/44'/${network.coinType}'/0'` }))
  }

  nearClient.addProvider(new NearRpcProvider(network))
  nearClient.addProvider(new NearSwapProvider())
  nearClient.addProvider(new NearSwapFindProvider(network.helperUrl))

  return nearClient
}

function createSolClient () {
  const solanaConfig = config.assets.SOL
  const solanaNetwork = SolanaNetworks[solanaConfig.network]

  const solanaClient = new Client()
  const derivationPath = `m/44'/501'/${solanaNetwork.walletIndex}'/0'`
  solanaClient.addProvider(new SolanaRpcProvider(solanaNetwork))
  solanaClient.addProvider(new SolanaWalletProvider(
    {
      network: solanaNetwork,
      mnemonic: solanaConfig.wallet.mnemonic,
      derivationPath
    }
  ))
  solanaClient.addProvider(new SolanaSwapProvider(solanaNetwork))
  solanaClient.addProvider(new SolanaSwapFindProvider(solanaNetwork))

  return solanaClient
}

function createTerraClient(asset){
  console.log(asset)
  const terraConfig = config.assets[asset]
  const terraNetwork = TerraNetworks[terraConfig.network]
  console.log(terraConfig)
  const terraClient = new Client()
  
  if (asset === 'UST') {
    terraClient.addProvider(new TerraRpcProvider({ ...terraNetwork, asset: 'uusd' }))
  } else {
    terraClient.addProvider(new TerraRpcProvider(terraNetwork))
  }

  terraClient.addProvider(new TerraWalletProvider(
    {
      network: terraNetwork,
      mnemonic,
      derivationPath
    }
  ))
  terraClient.addProvider(new TerraSwapProvider(terraNetwork))
  terraClient.addProvider(new TerraSwapFindProvider(terraNetwork))
  
  return terraClient
}

const clients = {}

function createClient (asset) {
  const assetData = assets[asset]

  if (assetData.chain === 'bitcoin') return createBtcClient()
  if (assetData.chain === 'rsk') return createEthClient(asset)
  if (assetData.chain === 'bsc') return createEthClient(asset)
  if (assetData.chain === 'polygon') return createEthClient(asset)
  if (assetData.chain === 'arbitrum') return createEthClient(asset)
  if (assetData.chain === 'ethereum') return createEthClient(asset)
  if (assetData.chain === 'near') return createNearClient()
  if (assetData.chain === 'solana') return createSolClient()
  if (assetData.chain === 'terra') return createTerraClient(asset)

  throw new Error(`Could not create client for asset ${asset}`)
}

function getClient (asset) {
  if (asset in clients) return clients[asset]
  const client = createClient(asset)
  clients[asset] = client
  return client
}

module.exports = { getClient }
