const Client = require('@liquality/client')
const LoanClient = require('@atomicloans/loan-client')

const {
  BTC_RPC, BTC_USER, BTC_PASS,
  ETH_RPC, ETH_USER, ETH_PASS
} = process.env

const BitcoinRpcProvider = require('@liquality/bitcoin-rpc-provider')
const BitcoinNodeWalletProvider = require('@liquality/bitcoin-node-wallet-provider')
const BitcoinSwapProvider = require('@liquality/bitcoin-swap-provider')
const BitcoinCollateralProvider = require('@atomicloans/bitcoin-collateral-provider')
const BitcoinCollateralSwapProvider = require('@atomicloans/bitcoin-collateral-swap-provider')
const BitcoinNetworks = require('@liquality/bitcoin-networks')

const EthereumRpcProvider = require('@liquality/ethereum-rpc-provider')
const EthereumSwapProvider = require('@liquality/ethereum-swap-provider')

const BTC = new Client()
const BTCLoan = new LoanClient(BTC)
BTC.loan = BTCLoan
BTC.addProvider(new BitcoinRpcProvider(BTC_RPC, BTC_USER, BTC_PASS))
BTC.addProvider(new BitcoinNodeWalletProvider(BitcoinNetworks['bitcoin_regtest'], BTC_RPC, BTC_USER, BTC_PASS))
BTC.addProvider(new BitcoinSwapProvider({ network: BitcoinNetworks['bitcoin_regtest'] }))
BTC.loan.addProvider(new BitcoinCollateralProvider({ network: BitcoinNetworks['bitcoin_regtest'] }))
BTC.loan.addProvider(new BitcoinCollateralSwapProvider({ network: BitcoinNetworks['bitcoin_regtest'] }))

const ETH = new Client()
ETH.addProvider(new EthereumRpcProvider(ETH_RPC, ETH_USER, ETH_PASS))
ETH.addProvider(new EthereumSwapProvider())

module.exports = {
  BTC,
  ETH
}
