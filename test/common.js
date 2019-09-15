require('dotenv').config()
const config = require('./config')
const { Client, providers } = require('@liquality/bundle')
const { LoanClient, providers: lproviders } = require('@atomicloans/loan-bundle')
const MetaMaskConnector = require('node-metamask')
const Web3 = require('web3')
const Web3HDWalletProvider = require('web3-hdwallet-provider')
const { generateMnemonic } = require('bip39')
const fs = require('fs')
const path = require('path')

const metaMaskConnector = new MetaMaskConnector({ port: config.ethereum.metaMaskConnector.port })

const mnemonic = 'shield various crystal grape prize weasel antique raven acoustic course rich stone keep ramp soldier joy matter fetch miracle connect banner apology risk junk'

const bitcoinNetworks = providers.bitcoin.networks
const bitcoinNetwork = bitcoinNetworks[config.bitcoin.network]

const bitcoinWithLedger = new Client()
const bitcoinLoanWithLedger = new LoanClient(bitcoinWithLedger)
bitcoinWithLedger.loan = bitcoinLoanWithLedger
bitcoinWithLedger.addProvider(new providers.bitcoin.BitcoinRpcProvider(config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password))
bitcoinWithLedger.addProvider(new providers.bitcoin.BitcoinLedgerProvider({ network: bitcoinNetworks[config.bitcoin.network], segwit: false }))
bitcoinWithLedger.loan.addProvider(new lproviders.bitcoin.BitcoinCollateralProvider({ network: bitcoinNetworks[config.bitcoin.network] }, { script: 'p2wsh', address: 'p2wpkh' }))
bitcoinWithLedger.loan.addProvider(new lproviders.bitcoin.BitcoinCollateralSwapProvider({ network: bitcoinNetworks[config.bitcoin.network] }, { script: 'p2wsh', address: 'p2wpkh' }))

const bitcoinWithJs = new Client()
const bitcoinLoanWithJs = new LoanClient(bitcoinWithJs)
bitcoinWithJs.loan = bitcoinLoanWithJs
bitcoinWithJs.addProvider(new providers.bitcoin.BitcoinRpcProvider(config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password))
bitcoinWithJs.addProvider(new providers.bitcoin.BitcoinJsWalletProvider(bitcoinNetworks[config.bitcoin.network], config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password, generateMnemonic(256), 'bech32'))
bitcoinWithJs.loan.addProvider(new lproviders.bitcoin.BitcoinCollateralProvider({ network: bitcoinNetworks[config.bitcoin.network] }, { script: 'p2wsh', address: 'p2wpkh' }))
bitcoinWithJs.loan.addProvider(new lproviders.bitcoin.BitcoinCollateralSwapProvider({ network: bitcoinNetworks[config.bitcoin.network] }, { script: 'p2wsh', address: 'p2wpkh' }))

const bitcoinWithNode = new Client()
bitcoinWithNode.addProvider(new providers.bitcoin.BitcoinRpcProvider(config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password))
bitcoinWithNode.addProvider(new providers.bitcoin.BitcoinNodeWalletProvider(bitcoinNetwork, config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password, 'bech32'))

const bitcoinArbiter = new Client()
const bitcoinLoanArbiter = new LoanClient(bitcoinArbiter)
bitcoinArbiter.loan = bitcoinLoanArbiter
bitcoinArbiter.addProvider(new providers.bitcoin.BitcoinRpcProvider(config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password))
bitcoinArbiter.addProvider(new providers.bitcoin.BitcoinJsWalletProvider(bitcoinNetworks[config.bitcoin.network], config.bitcoin.rpc.host, config.bitcoin.rpc.username, config.bitcoin.rpc.password, mnemonic, 'bech32'))
bitcoinArbiter.loan.addProvider(new lproviders.bitcoin.BitcoinCollateralProvider({ network: bitcoinNetworks[config.bitcoin.network] }, { script: 'p2wsh', address: 'p2wpkh' }))
bitcoinArbiter.loan.addProvider(new lproviders.bitcoin.BitcoinCollateralSwapProvider({ network: bitcoinNetworks[config.bitcoin.network] }, { script: 'p2wsh', address: 'p2wpkh' }))

const ethereumNetworks = providers.ethereum.networks
const ethereumNetwork = ethereumNetworks[config.ethereum.network]

const ethereumWithNode = new Client()
ethereumWithNode.addProvider(new providers.ethereum.EthereumRpcProvider(config.ethereum.rpc.host))

const ethereumWithMetaMask = new Client()
ethereumWithMetaMask.addProvider(new providers.ethereum.EthereumRpcProvider(config.ethereum.rpc.host))
ethereumWithMetaMask.addProvider(new providers.ethereum.EthereumMetaMaskProvider(metaMaskConnector.getProvider()))

const ethereumArbiter = new Client()
ethereumArbiter.addProvider(new providers.ethereum.EthereumRpcProvider(config.ethereum.rpc.host))
ethereumArbiter.addProvider(new providers.ethereum.EthereumJsWalletProvider(ethereumNetwork, mnemonic))

const web3WithMetaMask = new Web3(metaMaskConnector.getProvider())

const httpProvider = new Web3.providers.HttpProvider(config.ethereum.rpc.host)
const provider = new Web3HDWalletProvider(mnemonic, httpProvider)
const web3WithArbiter = new Web3(provider)

const web3WithNode = new Web3(new Web3.providers.HttpProvider(config.ethereum.rpc.host))

const hdWalletProvider = new Web3HDWalletProvider(getEnvTestValue('ETH_SIGNER_MNEMONIC').toString(), httpProvider)
const web3WithHDWallet = new Web3(hdWalletProvider)

const chains = {
  bitcoinWithLedger: { id: 'Bitcoin Ledger', name: 'bitcoin', client: bitcoinWithLedger },
  bitcoinWithJs: { id: 'Bitcoin Js', name: 'bitcoin', client: bitcoinWithJs, network: bitcoinNetwork },
  bitcoinWithNode: { id: 'Bitcoin Node', name: 'bitcoin', client: bitcoinWithNode, network: bitcoinNetwork },
  bitcoinArbiter: { id: 'Bitcoin Arbiter', name: 'bitcoin', client: bitcoinArbiter, network: bitcoinNetwork },
  ethereumWithNode: { id: 'Ethereum Node', name: 'ethereum', client: ethereumWithNode },
  ethereumWithMetaMask: { id: 'Ethereum MetaMask', name: 'ethereum', client: ethereumWithMetaMask },
  ethereumArbiter: { id: 'Ethereum Arbiter', name: 'ethereum', client: ethereumArbiter },
  web3WithNode: { id: 'Web3 Node', name: 'ethereum', client: web3WithNode },
  web3WithMetaMask: { id: 'Web3 MetaMask', name: 'ethereum', client: web3WithMetaMask },
  web3WithArbiter: { id: 'Web3 Arbiter', name: 'ethereum', client: web3WithArbiter },
  web3WithHDWallet: { id: 'Web3 HDWallet', name: 'ethereum', client: web3WithHDWallet }
}

async function importBitcoinAddresses (chain) {
  const nonChangeAddresses = await chain.client.getMethod('getAddresses')(0, 10)
  const changeAddresses = await chain.client.getMethod('getAddresses')(0, 10, true)

  const addresses = [...nonChangeAddresses, ...changeAddresses]

  const addressesToImport = []
  for (const address of addresses) {
    addressesToImport.push({ scriptPubKey: { address: address.address }, timestamp: 'now' })
  }

  await chain.client.getMethod('jsonrpc')('importmulti', addressesToImport, { rescan: false })
}

async function importBitcoinAddressesByAddress (addresses) {
  const addressesToImport = []
  for (const address of addresses) {
    addressesToImport.push({ scriptPubKey: { address: address }, timestamp: 'now' })
  }

  await chains.bitcoinWithNode.client.getMethod('jsonrpc')('importmulti', addressesToImport, { rescan: false })
}

async function fundUnusedBitcoinAddress (chain) {
  const unusedAddress = await chain.client.wallet.getUnusedAddress()
  await chains.bitcoinWithNode.client.chain.sendTransaction(unusedAddress, 100000000)
  await chains.bitcoinWithNode.client.chain.generateBlock(1)
}

function getEnvTestValue (key) {
  const env = fs.readFileSync(path.resolve(process.cwd(), 'test/env/.env.test'), 'utf-8')
  const regex = new RegExp(`${key}=("(.*?)"|([0-9a-zA-Z])\\w+)`, 'g')
  const value = env.match(regex)
  return value.toString().replace(`${key}=`, '').replace('"', '').replace('"', '')
}

function rewriteEnv (envFile, key, value) {
  const env = fs.readFileSync(path.resolve(process.cwd(), envFile), 'utf-8')
  const regex = new RegExp(`${key}=("(.*?)"|([0-9a-zA-Z])\\w+)`, 'g')
  const newEnv = env.replace(regex, `${key}=${value}`)
  fs.writeFileSync(path.resolve(process.cwd(), envFile), newEnv, 'utf-8')
}

function connectMetaMask () {
  before(async () => {
    console.log('\x1b[36m', 'Starting MetaMask connector on http://localhost:3333 - Open in browser to continue', '\x1b[0m')
    await metaMaskConnector.start()
  })
  after(async () => metaMaskConnector.stop())
}

module.exports = {
  chains,
  connectMetaMask,
  importBitcoinAddresses,
  importBitcoinAddressesByAddress,
  fundUnusedBitcoinAddress,
  rewriteEnv
}
