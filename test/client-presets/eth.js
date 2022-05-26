const { EvmChainProvider, EvmWalletProvider, EvmSwapProvider, EvmNetworks } = require('@chainify/evm')
const { HTLC_ADDRESS } = require('../../src/utils/chainify')
const { Client } = require('@chainify/client')

async function createEthClient(config) {
  const network = {
    ...EvmNetworks.local,
    name: 'mainnet',
    chainId: 1337,
    networkId: 1337,
    rpcUrl: config.rpc.url
  }

  const chainProvider = new EvmChainProvider(network, null, null, false)

  const walletProvider = new EvmWalletProvider(
    { derivationPath: `m/44'/${network.coinType}'/0'/0/0`, mnemonic: config.wallet.mnemonic },
    chainProvider
  )
  const swapProvider = new EvmSwapProvider({ contractAddress: `0x${HTLC_ADDRESS}` }, walletProvider)

  return new Client().connect(swapProvider)
}

module.exports = createEthClient
