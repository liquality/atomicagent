const { EthereumRpcProvider } = require('@liquality/ethereum-rpc-provider')
const { EthereumJsWalletProvider } = require('@liquality/ethereum-js-wallet-provider')
const { EthereumSwapProvider } = require('@liquality/ethereum-swap-provider')
const { EthereumScraperSwapFindProvider } = require('@liquality/ethereum-scraper-swap-find-provider')
const { EthereumRpcFeeProvider } = require('@liquality/ethereum-rpc-fee-provider')
const { EthereumNetworks } = require('@liquality/ethereum-networks')

let network = EthereumNetworks.local

network = {
  ...network,
  name: 'mainnet',
  chainId: 1337,
  networkId: 1337
}

module.exports = [
  {
    provider: EthereumRpcProvider,
    args: (config) => [
      {
        uri: config.assetConfig.rpc.url
      }
    ]
  },
  {
    provider: EthereumRpcFeeProvider
  },
  {
    provider: EthereumJsWalletProvider,
    requires: ['mnemonic'],
    args: (config) => [
      {
        network,
        mnemonic: config.mnemonic,
        derivationPath: `m/44'/${network.coinType}'/0'/0/0`
      }
    ]
  },
  {
    provider: EthereumSwapProvider
  },
  {
    provider: EthereumScraperSwapFindProvider,
    args: (config) => [config.assetConfig.scraper.url]
  }
]
