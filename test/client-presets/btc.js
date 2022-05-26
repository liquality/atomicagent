const {
  BitcoinEsploraApiProvider,
  BitcoinHDWalletProvider,
  BitcoinSwapEsploraProvider,
  BitcoinNetworks
} = require('@chainify/bitcoin')
const { Client } = require('@chainify/client')

async function createBtcClient(config) {
  const network = BitcoinNetworks.bitcoin_regtest

  const chainProvider = new BitcoinEsploraApiProvider({
    network,
    batchUrl: config.batchApi.url,
    url: config.api.url,
    numberOfBlockConfirmation: config.feeNumberOfBlocks
  })

  const walletProvider = new BitcoinHDWalletProvider(
    {
      network,
      mnemonic: config.wallet.mnemonic,
      baseDerivationPath: `m/84'/${network.coinType}'/0'`
    },
    chainProvider
  )

  const swapProvider = new BitcoinSwapEsploraProvider({ network, scraperUrl: config.api.url }, walletProvider)

  return new Client().connect(swapProvider)
}

module.exports = createBtcClient
