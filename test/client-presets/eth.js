const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider').default
const EthereumJsWalletProvider = require('@liquality/ethereum-js-wallet-provider').default
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider').default
const EthereumScraperSwapFindProvider = require('@liquality/ethereum-scraper-swap-find-provider').default
const EthereumRpcFeeProvider = require('@liquality/ethereum-rpc-fee-provider').default
const EthereumNetworks = require('@liquality/ethereum-networks').default

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
    args: config => [{
      uri: config.assetConfig.rpc.url
    }]
  },
  {
    provider: EthereumJsWalletProvider,
    requires: ['mnemonic'],
    args: config => [
      network,
      config.mnemonic
    ]
  },
  {
    provider: EthereumSwapProvider
  },
  {
    provider: EthereumScraperSwapFindProvider,
    args: config => [
      config.assetConfig.scraper.url
    ]
  },
  {
    provider: EthereumRpcFeeProvider
  }
]
