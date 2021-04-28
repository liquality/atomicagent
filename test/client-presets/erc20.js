const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider').default
const EthereumJsWalletProvider = require('@liquality/ethereum-js-wallet-provider').default
const EthereumErc20Provider = require('@liquality/ethereum-erc20-provider').default
const EthereumErc20SwapProvider = require('@liquality/ethereum-erc20-swap-provider').default
const EthereumErc20ScraperSwapFindProvider = require('@liquality/ethereum-erc20-scraper-swap-find-provider').default
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
    provider: EthereumErc20Provider,
    args: config => [
      config.assetConfig.contractAddress
    ]
  },
  {
    provider: EthereumErc20SwapProvider
  },
  {
    provider: EthereumErc20ScraperSwapFindProvider,
    args: config => [
      config.assetConfig.scraper.url
    ]
  },
  {
    provider: EthereumRpcFeeProvider
  }
]
