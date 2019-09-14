const { chains, connectMetaMask, importBitcoinAddresses, importBitcoinAddressesByAddress, fundUnusedBitcoinAddress, rewriteEnv, setNewWeb3HDWallet } = require('../common')
const { testLoadObject } = require('./util/contracts')
const { getWeb3Address } = require('./util/web3Helpers')
const { ensure0x, remove0x, checksumEncode } = require('@liquality/ethereum-utils')
const { sha256 } = require('@liquality/crypto')
const web3 = require('../../src/utils/web3')
const { numToBytes32 } = require('../../src/utils/finance')
const { toWei } = web3.utils

const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const lenderServer = 'http://localhost:3030/api/loan'
const arbiterServer = 'http://localhost:3032/api/loan'

async function fundArbiter () {
  const unusedAddress = (await chains.web3WithArbiter.client.currentProvider.getAddresses())[0]
  console.log('arbiterUnusedAddress', unusedAddress)
  await chains.ethereumWithNode.client.chain.sendTransaction(unusedAddress, toWei('1', 'ether'))
}

async function generateSecretHashesArbiter (principal) {
  const address = (await chains.web3WithArbiter.client.currentProvider.getAddresses())[0]
  const { publicKey } = await chains.bitcoinArbiter.client.wallet.getUnusedAddress()

  const secrets = await chains.bitcoinWithJs.client.loan.secrets.generateSecrets('test', 40)
  const secretHashes = secrets.map(secret => ensure0x(sha256(secret)))

  const testFunds = await testLoadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`], chains.web3WithArbiter, address)
  await testFunds.methods.generate(secretHashes).send({ from: address, gas: 6000000 })
  await testFunds.methods.setPubKey(ensure0x(publicKey.toString('hex'))).send({ from: address, gas: 6000000 })
}

async function getLockParams (web3Chain, principal, values, loanId) {
  const address = await getWeb3Address(web3Chain)
  const testLoans = await testLoadObject('loans', process.env[`${principal}_LOAN_LOANS_ADDRESS`], web3Chain, address)

  const { borrowerPubKey, lenderPubKey, arbiterPubKey } = await testLoans.methods.pubKeys(numToBytes32(loanId)).call()
  const { secretHashA1, secretHashB1, secretHashC1 } = await testLoans.methods.secretHashes(numToBytes32(loanId)).call()
  const approveExpiration = await testLoans.methods.approveExpiration(numToBytes32(loanId)).call()
  const liquidationExpiration = await testLoans.methods.liquidationExpiration(numToBytes32(loanId)).call()
  const seizureExpiration = await testLoans.methods.seizureExpiration(numToBytes32(loanId)).call()
  
  const pubKeys = { borrowerPubKey: remove0x(borrowerPubKey), lenderPubKey: remove0x(lenderPubKey), agentPubKey: remove0x(arbiterPubKey) }
  const secretHashes = { secretHashA1: remove0x(secretHashA1), secretHashB1: remove0x(secretHashB1), secretHashC1: remove0x(secretHashC1) }
  const expirations = { approveExpiration, liquidationExpiration, seizureExpiration }

  return [values, pubKeys, secretHashes, expirations]
}

async function getTestObject (web3Chain, contract, principal) {
  const address = await getWeb3Address(web3Chain)
  if (contract === 'erc20') {
    return testLoadObject(contract, process.env[`${principal}_ADDRESS`], web3Chain, address)
  } else {
    return testLoadObject(contract, process.env[`${principal}_LOAN_${contract.toUpperCase()}_ADDRESS`], web3Chain, address)
  }
}

async function fundWeb3Address (web3Chain) {
  const address = await getWeb3Address(web3Chain)
  await chains.ethereumWithNode.client.chain.sendTransaction(address, 10000000000000000)
}

async function cancelLoans (chain) {
  const timestamp = Math.floor(new Date().getTime() / 1000)
  const address = await getWeb3Address(chain)
  const message = `Cancel all loans for ${address} at ${timestamp}`

  console.log('message', message)

  const signature = await chain.client.eth.personal.sign(message, address)

  await chai.request(lenderServer).post('/loans/cancel_all').send({ timestamp, signature, message })
}

module.exports = {
  fundArbiter,
  generateSecretHashesArbiter,
  getLockParams,
  getTestObject,
  cancelLoans,
  fundWeb3Address
}
