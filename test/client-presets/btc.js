const BitcoinEsploraBatchApiProvider = require('@liquality/bitcoin-esplora-batch-api-provider')
const BitcoinJsWalletProvider = require('@liquality/bitcoin-js-wallet-provider')
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider')
const BitcoinEsploraSwapFindProvider = require('@liquality/bitcoin-esplora-swap-find-provider')
const BitcoinRpcFeeProvider = require('@liquality/bitcoin-rpc-fee-provider')
const BitcoinNetworks = require('@liquality/bitcoin-networks')

module.exports = [
  {
    provider: BitcoinEsploraBatchApiProvider,
    args: config => [
      config.assetConfig.batchApi.url,
      config.assetConfig.api.url,
      BitcoinNetworks.bitcoin_regtest,
      config.assetConfig.feeNumberOfBlocks
    ]
  },
  {
    provider: BitcoinJsWalletProvider,
    requires: ['mnemonic'],
    args: config => [
      BitcoinNetworks.bitcoin_regtest,
      config.mnemonic
    ]
  },
  {
    provider: BitcoinSwapProvider,
    args: [
      BitcoinNetworks.bitcoin_regtest
    ]
  },
  {
    provider: BitcoinEsploraSwapFindProvider,
    args: config => [
      config.assetConfig.api.url
    ]
  },
  {
    provider: BitcoinRpcFeeProvider
  }
]
