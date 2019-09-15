/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')
const { generateMnemonic } = require('bip39')

const { chains, connectMetaMask, rewriteEnv } = require('../../common')
const { fundWeb3Address } = require('../loanCommon')
const { getWeb3Address } = require('../util/web3Helpers')
const web3 = require('web3')
const { toWei } = web3.utils

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

function testWithdraw (chain) {
  describe('/POST withdraw - Withdraw excess funds', () => {
    it('should return eth to metamask user if ETH_SIGNER', async () => {
      const timestamp = Math.floor(new Date().getTime() / 1000)
      const amount = 1
      const currency = 'ETH'
      const address = await getWeb3Address(chain)
      const message = `Withdraw ${amount} ${currency} to ${address} at ${timestamp}`

      await chains.ethereumWithNode.client.chain.sendTransaction(address, toWei(amount.toString(), 'ether'))

      const signature = await chain.client.eth.personal.sign(message, address)
      const balanceBefore = await chains.ethereumWithNode.client.chain.getBalance(address)

      await chai.request(server).post('/withdraw').send({ currency, timestamp, signature, amount, message })

      const balanceAfter = await chains.ethereumWithNode.client.chain.getBalance(address)

      expect(BN(balanceAfter).toFixed()).to.equal(BN(balanceBefore).plus(BN(toWei(amount.toString(), 'ether'))).toFixed())
    })
  })
}

describe('Lender Agent - Withdraw', () => {
  describe('Web3HDWallet', () => {
    before(async function () {
      await fundWeb3Address(chains.web3WithHDWallet)
      const address = await getWeb3Address(chains.web3WithHDWallet)
      rewriteEnv('.env', 'ETH_SIGNER', address)
      rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
    })
    testWithdraw(chains.web3WithHDWallet)
  })

  describe('MetaMask', () => {
    connectMetaMask()
    before(async function () {
      await fundWeb3Address(chains.web3WithMetaMask)
      const address = await getWeb3Address(chains.web3WithMetaMask)
      rewriteEnv('.env', 'ETH_SIGNER', address)
      rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
    })
    testWithdraw(chains.web3WithMetaMask)
  })
})
