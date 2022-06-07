const { assets } = require('./cryptoassets')
const config = require('../config')
const secretManager = require('./secretManager')
const { HTLC_ADDRESS } = require('./chainify')

const { Client } = require('@chainify/client')

const {
  BitcoinNetworks,
  BitcoinEsploraApiProvider,
  BitcoinFeeApiProvider,
  BitcoinHDWalletProvider,
  BitcoinSwapEsploraProvider
} = require('@chainify/bitcoin')

const {
  EvmChainProvider,
  EvmSwapProvider,
  EvmWalletProvider,
  EvmNetworks,
  EIP1559FeeProvider,
  RpcFeeProvider
} = require('@chainify/evm')

const { NearChainProvider, NearSwapProvider, NearWalletProvider, NearNetworks } = require('@chainify/near')
const { SolanaChainProvider, SolanaWalletProvider, SolanaNetworks } = require('@chainify/solana')
const { TerraChainProvider, TerraSwapProvider, TerraWalletProvider, TerraNetworks } = require('@chainify/terra')

async function createBtcClient() {
  const btcConfig = config.assets.BTC
  const network = BitcoinNetworks[btcConfig.network]

  if (btcConfig.addressType === 'p2sh-segwit') {
    throw new Error('Wrapped segwit addresses (p2sh-segwit) are currently unsupported.')
  }

  const mnemonic = await secretManager.getMnemonic('BTC')

  const chainProvider = new BitcoinEsploraApiProvider({
    batchUrl: btcConfig.batchApi.url,
    url: btcConfig.api.url,
    network: network,
    numberOfBlockConfirmation: btcConfig.feeNumberOfBlocks
  })

  const walletProvider = new BitcoinHDWalletProvider(
    {
      network,
      mnemonic,
      baseDerivationPath: `m/84'/${network.coinType}'/0'`
    },
    chainProvider
  )

  const swapProvider = new BitcoinSwapEsploraProvider({ network, scraperUrl: btcConfig.api.url }, walletProvider)

  if (!network.isTestnet) {
    const feeProvider = new BitcoinFeeApiProvider('https://liquality.io/swap/mempool/v1/fees/recommended')
    chainProvider.setFeeProvider(feeProvider)
  }

  return new Client().connect(swapProvider)
}

async function createEthClient(asset) {
  const assetData = assets[asset]
  const assetConfig = config.assets[asset]
  let network = { ...EvmNetworks[assetConfig.network], rpcUrl: assetConfig.rpc.url }
  if (network.name === 'local') {
    network = {
      ...network,
      name: 'mainnet',
      chainId: 1337,
      networkId: 1337,
      local: true
    }
  }

  const mnemonic = await secretManager.getMnemonic(asset)

  const chainProvider = new EvmChainProvider(network, null, null, false)

  let feeProvider
  if (!network.local && (assetData.chain === 'ethereum' || (assetData.chain === 'polygon' && network.isTestnet))) {
    feeProvider = new EIP1559FeeProvider(assetConfig.rpc.url)
  } else {
    feeProvider = new RpcFeeProvider(assetConfig.rpc.url)
  }

  chainProvider.setFeeProvider(feeProvider)

  const walletProvider = new EvmWalletProvider(
    { derivationPath: `m/44'/${network.coinType}'/0'/0/0`, mnemonic },
    chainProvider
  )
  const swapProvider = new EvmSwapProvider({ contractAddress: `0x${HTLC_ADDRESS}` }, walletProvider)

  return new Client().connect(swapProvider)
}

async function createNearClient() {
  const nearConfig = config.assets.NEAR
  const defaultConfig = NearNetworks[nearConfig.network]
  const nearNetwork = { ...defaultConfig, nodeUrl: nearConfig.rpc?.url || defaultConfig.nodeUrl }

  const mnemonic = await secretManager.getMnemonic('NEAR')
  const nearHelperUrl = nearConfig.helperUrl?.url ? nearConfig.helperUrl?.url : nearNetwork.helperUrl

  const walletOptions = {
    mnemonic,
    derivationPath: `m/44'/${nearNetwork.coinType}'/0'`,
    helperUrl: nearHelperUrl
  }
  const chainProvider = new NearChainProvider(nearNetwork)
  const walletProvider = new NearWalletProvider(walletOptions, chainProvider)
  const swapProvider = new NearSwapProvider(nearHelperUrl, walletProvider)
  return new Client().connect(swapProvider)
}

async function createTerraClient(asset) {
  const terraConfig = config.assets[asset]
  const defaultConfig = TerraNetworks[terraConfig.network]
  const terraNetwork = {
    ...defaultConfig,
    nodeUrl: terraConfig.rpc?.url || defaultConfig.nodeUrl
  }
  const mnemonic = await secretManager.getMnemonic('LUNA')
  const { helperUrl } = terraNetwork
  const walletOptions = { mnemonic, derivationPath: `'m/44'/${terraNetwork.coinType}'/0'`, helperUrl }
  const chainProvider = new TerraChainProvider(terraNetwork)
  const walletProvider = new TerraWalletProvider(walletOptions, chainProvider)
  const swapProvider = new TerraSwapProvider(helperUrl, walletProvider)
  return new Client().connect(swapProvider)
}

async function createSolanaClient() {
  const solanaConfig = config.assets.SOL
  const defaultConfig = SolanaNetworks[solanaConfig.network]
  const solanaNetwork = {
    ...defaultConfig,
    nodeUrl: solanaConfig.rpc?.url || defaultConfig.nodeUrl
  }
  const mnemonic = await secretManager.getMnemonic('SOL')
  const walletOptions = { mnemonic, derivationPath: `m/44'/501'/${solanaNetwork.walletIndex}'/0'` }
  const chainProvider = new SolanaChainProvider(solanaNetwork)
  const walletProvider = new SolanaWalletProvider(walletOptions, chainProvider)
  return new Client().connect(walletProvider)
}

const clients = {}

async function createClient(asset) {
  const assetData = assets[asset]

  if (assetData.chain === 'bitcoin') return createBtcClient()
  if (assetData.chain === 'rsk') return createEthClient(asset)
  if (assetData.chain === 'bsc') return createEthClient(asset)
  if (assetData.chain === 'polygon') return createEthClient(asset)
  if (assetData.chain === 'avalanche') return createEthClient(asset)
  if (assetData.chain === 'arbitrum') return createEthClient(asset)
  if (assetData.chain === 'ethereum') return createEthClient(asset)
  if (assetData.chain === 'near') return createNearClient()
  if (assetData.chain === 'solana') return createSolanaClient()
  if (assetData.chain === 'terra') return createTerraClient(asset)

  throw new Error(`Could not create client for asset ${asset}`)
}

async function getClient(asset) {
  if (asset in clients) return clients[asset]
  const client = await createClient(asset)
  clients[asset] = client
  return client
}

module.exports = { getClient }
