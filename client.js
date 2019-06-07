const { Client, providers } = require('@liquality/bundle')

const btc = new Client()
btc.addProvider(new providers.bitcoin.BitcoinBitcoreRpcProvider(process.env.BITCOIN_RPC, process.env.BITCOIN_USER, process.env.BITCOIN_PASS))
btc.addProvider(new providers.bitcoin.BitcoinBitcoinJsLibSwapProvider({ network: providers.bitcoin.networks['bitcoin_testnet'] }))

const eth = new Client()
eth.addProvider(new providers.ethereum.EthereumRpcProvider(process.env.ETHEREUM_RPC, process.env.ETHEREUM_USER, process.env.ETHEREUM_PASS))
eth.addProvider(new providers.ethereum.EthereumSwapProvider())

module.exports = {
  btc,
  eth
}
