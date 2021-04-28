const BitcoinEsploraBatchApiProvider = require('@liquality/bitcoin-esplora-batch-api-provider').default
const BitcoinJsWalletProvider = require('@liquality/bitcoin-js-wallet-provider').default
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider').default
const BitcoinEsploraSwapFindProvider = require('@liquality/bitcoin-esplora-swap-find-provider').default
const BitcoinRpcFeeProvider = require('@liquality/bitcoin-rpc-fee-provider').default
const BitcoinNetworks = require('@liquality/bitcoin-networks').default

module.exports = [
  {
    provider: BitcoinEsploraBatchApiProvider,
    args: config => [{
      batchUrl: config.assetConfig.batchApi.url,
      url: config.assetConfig.api.url,
      network: BitcoinNetworks.bitcoin_regtest,
      numberOfBlockConfirmation: config.assetConfig.feeNumberOfBlocks
    }]
  },
  {
    provider: BitcoinJsWalletProvider,
    requires: ['mnemonic'],
    args: config => [{
      network: BitcoinNetworks.bitcoin_regtest,
      mnemonic: config.mnemonic
    }]
  },
  {
    provider: BitcoinSwapProvider,
    args: [{
      network: BitcoinNetworks.bitcoin_regtest
    }]
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
