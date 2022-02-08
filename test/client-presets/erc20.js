const { EthereumRpcProvider } = require('@liquality/ethereum-rpc-provider')
const { EthereumJsWalletProvider } = require('@liquality/ethereum-js-wallet-provider')
const { EthereumErc20Provider } = require('@liquality/ethereum-erc20-provider')
const { EthereumErc20SwapProvider } = require('@liquality/ethereum-erc20-swap-provider')
const { EthereumErc20ScraperSwapFindProvider } = require('@liquality/ethereum-erc20-scraper-swap-find-provider')
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
    provider: EthereumErc20Provider,
    args: (config) => [config.assetConfig.contractAddress]
  },
  {
    provider: EthereumErc20SwapProvider
  },
  {
    provider: EthereumErc20ScraperSwapFindProvider,
    args: (config) => [config.assetConfig.scraper.url]
  }
]
