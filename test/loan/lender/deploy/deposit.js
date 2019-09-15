/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')

const { chains, connectMetaMask } = require('../../../common')
const { fundArbiter, fundAgent, generateSecretHashesArbiter, fundWeb3Address, getAgentAddress, getTestObjects } = require('../../loanCommon')
const { depositToFund } = require('../setup/fundSetup')
const { currencies } = require('../../../../src/utils/fx')
const { numToBytes32 } = require('../../../../src/utils/finance')
const web3 = require('web3')

const { toWei } = web3.utils

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

const principal = process.env.PRINCIPAL
const amount = process.env.AMOUNT

function depositForFund (web3Chain) {
  describe(`Deposit ${principal} to Loan Fund`, () => {
    it(`should deposit ${amount} ${principal} to loan fund`, async () => {
      const [token, funds] = await getTestObjects(web3Chain, principal, ['erc20', 'funds'])
      const agentAddress = await getAgentAddress(server)
      const balanceBefore = await token.methods.balanceOf(process.env[`${principal}_LOAN_FUNDS_ADDRESS`]).call()

      const fundId = await depositToFund(web3Chain, amount, principal) // Create Custom Loan Fund with 200 DAI

      const balanceAfter = await token.methods.balanceOf(process.env[`${principal}_LOAN_FUNDS_ADDRESS`]).call()
      const { lender } = await funds.methods.funds(numToBytes32(fundId)).call()

      expect(balanceAfter.toString()).to.equal(BN(balanceBefore).plus(toWei(amount.toString(), currencies[principal].unit)).toString())
      expect(lender).to.equal(agentAddress)
    })
  })
}

async function testSetup (web3Chain) {
  await fundAgent(server)
  await fundArbiter()
  await generateSecretHashesArbiter(principal)
  await fundWeb3Address(web3Chain)
}

describe('Lender Agent - Deploy - Deposit', () => {
  describe('MetaMask', () => {
    connectMetaMask()
    before(async function () { await testSetup(chains.web3WithMetaMask) })
    depositForFund(chains.web3WithMetaMask)
  })
})
