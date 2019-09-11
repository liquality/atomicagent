const Web3 = require('web3')
const Web3HDWalletProvider = require('web3-hdwallet-provider')

const { MNEMONIC, ETH_RPC } = process.env

const httpProvider = new Web3.providers.HttpProvider(ETH_RPC)
const provider = new Web3HDWalletProvider(MNEMONIC, httpProvider)
const web3 = new Web3(provider)

module.exports = web3
