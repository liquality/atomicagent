/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')
const { checksumEncode } = require('@liquality/ethereum-utils')
const { generateMnemonic } = require('bip39')

const { chains, connectMetaMask, rewriteEnv } = require('../../common')
const { fundArbiter, fundAgent, fundTokens, getAgentAddress, generateSecretHashesArbiter, getTestObjects, cancelLoans, removeFunds, cancelJobs, fundWeb3Address,  } = require('../loanCommon')
const { testLoadObject } = require('../util/contracts')
const fundFixtures = require('./fixtures/fundFixtures')
const { getWeb3Address } = require('../util/web3Helpers')
const { currencies } = require('../../../src/utils/fx')
const { numToBytes32, rateToSec } = require('../../../src/utils/finance')
const { createCustomFund, checkFundCreated } = require('./setup/fundSetup')
const web3 = require('web3')
const { toWei, fromWei } = web3.utils

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

const arbiterChain = chains.web3WithArbiter

const WAD = BN(10).pow(18)

function testFunds (web3Chain) {
  describe('Create Custom Loan Fund', () => {
    it('should create a new loan fund and deposit funds into it', async () => {
      const principal = 'DAI'
      const amount = 200
      const fixture = fundFixtures.customFundWithFundExpiryIn100Days
      const [funds] = await getTestObjects(web3Chain, principal, ['funds'])

      const { fundId, fundParams, amountDeposited, agentAddress } = await createFundFromFixture(web3Chain, fixture, principal, amount)
      const { fundExpiry, liquidationRatio, interest, penalty, fee } = fundParams

      const {
        lender, maxLoanDur, fundExpiry: actualFundExpiry, interest: actualInterest, penalty: actualPenalty, fee: actualFee, liquidationRatio: actualLiquidationRatio, balance
      } = await funds.methods.funds(numToBytes32(fundId)).call()

      expect(fromWei(balance, 'wei')).to.equal(amountDeposited)
      expect(lender).to.equal(checksumEncode(agentAddress))
      expect(maxLoanDur).to.equal(BN(2).pow(256).minus(1).toFixed())
      expect(actualFundExpiry).to.equal(fundExpiry.toString())
      expect(actualLiquidationRatio).to.equal(toWei((liquidationRatio / 100).toString(), 'gether'))
      expect(actualInterest).to.equal(toWei(rateToSec(interest.toString()), 'gether'))
      expect(actualPenalty).to.equal(toWei(rateToSec(penalty.toString()), 'gether'))
      expect(actualFee).to.equal(toWei(rateToSec(fee.toString()), 'gether'))
    })

    it('should return 401 when attempting to create more than one fund with same principal', async () => {
      const currentTime = Math.floor(new Date().getTime() / 1000)

      await createCustomFund(web3Chain, arbiterChain, 200, 'DAI')

      const fundParams = fundFixtures.customFundWithFundExpiryIn100Days(currentTime, 'DAI')
      const { status } = await chai.request(server).post('/funds/new').send(fundParams)

      expect(status).to.equal(401)
    })

    it('should succeed in creating two funds with different principal', async () => {
      const currentTime = Math.floor(new Date().getTime() / 1000)

      await createCustomFund(web3Chain, arbiterChain, 200, 'DAI')

      const fundParams = fundFixtures.customFundWithFundExpiryIn100Days(currentTime, 'USDC')
      const { status } = await chai.request(server).post('/funds/new').send(fundParams)

      expect(status).to.equal(200)
    })
  })

  describe('Create Custom Loan Fund with Compound Enabled', () => {
    it('should create a new loan fund and deposit funds into it', async () => {
      const principal = 'DAI'
      const amount = 200
      const fixture = fundFixtures.customFundWithFundExpiryIn100DaysAndCompoundEnabled
      const [funds, ctoken] = await getTestObjects(web3Chain, principal, ['funds', 'ctoken'])

      const { fundId, fundParams, amountDeposited, agentAddress } = await createFundFromFixture(web3Chain, fixture, principal, amount)
      const { fundExpiry, liquidationRatio, interest, penalty, fee } = fundParams

      const {
        lender, maxLoanDur, fundExpiry: actualFundExpiry, interest: actualInterest, penalty: actualPenalty, fee: actualFee, liquidationRatio: actualLiquidationRatio, cBalance
      } = await funds.methods.funds(numToBytes32(fundId)).call()

      const exchangeRateCurrent = await ctoken.methods.exchangeRateCurrent().call()
      const expectedCBalance = BN(amountDeposited).times(WAD).dividedBy(exchangeRateCurrent).toString()

      expect(fromWei(cBalance, 'wei')).to.equal(expectedCBalance)
      expect(lender).to.equal(checksumEncode(agentAddress))
      expect(maxLoanDur).to.equal(BN(2).pow(256).minus(1).toFixed())
      expect(actualFundExpiry).to.equal(fundExpiry.toString())
      expect(actualLiquidationRatio).to.equal(toWei((liquidationRatio / 100).toString(), 'gether'))
      expect(actualInterest).to.equal(toWei(rateToSec(interest.toString()), 'gether'))
      expect(actualPenalty).to.equal(toWei(rateToSec(penalty.toString()), 'gether'))
      expect(actualFee).to.equal(toWei(rateToSec(fee.toString()), 'gether'))
    })
  })

  describe('Create Regular Loan Fund', () => {
    it('should create a new loan fund and deposit funds into it', async () => {
      const currentTime = Math.floor(new Date().getTime() / 1000)
      const agentPrincipalAddress = await getAgentAddress(server)
      const address = await getWeb3Address(web3Chain)
      const fundParams = fundFixtures.fundWithFundExpiryIn100Days(currentTime, 'DAI')
      const { principal, fundExpiry } = fundParams
      const [token, funds] = await getTestObjects(web3Chain, principal, ['erc20', 'funds'])
      const unit = currencies[principal].unit
      const amountToDeposit = toWei('200', unit)
      await fundTokens(address, amountToDeposit, principal)

      const { body } = await chai.request(server).post('/funds/new').send(fundParams)
      const { id: fundModelId } = body

      const fundId = await checkFundCreated(fundModelId)

      await token.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send({ gas: 100000 })
      await funds.methods.deposit(numToBytes32(fundId), amountToDeposit).send({ gas: 500000 })

      const {
        lender, maxLoanDur, fundExpiry: actualFundExpiry, interest: actualInterest, penalty: actualPenalty, fee: actualFee, liquidationRatio: actualLiquidationRatio, balance
      } = await funds.methods.funds(numToBytes32(fundId)).call()

      expect(fromWei(balance, 'wei')).to.equal(amountToDeposit)
      expect(lender).to.equal(checksumEncode(agentPrincipalAddress))
      expect(maxLoanDur).to.equal(BN(2).pow(256).minus(1).toFixed())
      expect(actualFundExpiry).to.equal(fundExpiry.toString())
    })
  })

  describe('Create Regular Loan Fund with Compound Enabled', () => {
    it('should create a new loan fund and deposit funds into it', async () => {
      const principal = 'DAI'
      const amount = 200
      const fixture = fundFixtures.fundWithFundExpiryIn100DaysAndCompoundEnabled
      const [funds, ctoken] = await getTestObjects(web3Chain, principal, ['funds', 'ctoken'])

      const { fundId, fundParams, amountDeposited, agentAddress } = await createFundFromFixture(web3Chain, fixture, principal, amount)
      const { fundExpiry, liquidationRatio, interest, penalty, fee } = fundParams

      const {
        lender, maxLoanDur, fundExpiry: actualFundExpiry, interest: actualInterest, penalty: actualPenalty, fee: actualFee, liquidationRatio: actualLiquidationRatio, cBalance
      } = await funds.methods.funds(numToBytes32(fundId)).call()

      const exchangeRateCurrent = await ctoken.methods.exchangeRateCurrent().call()
      const expectedCBalance = BN(amountDeposited).times(WAD).dividedBy(exchangeRateCurrent).toString()

      expect(fromWei(cBalance, 'wei')).to.equal(expectedCBalance)
      expect(lender).to.equal(checksumEncode(agentAddress))
      expect(maxLoanDur).to.equal(BN(2).pow(256).minus(1).toFixed())
      expect(actualFundExpiry).to.equal(fundExpiry.toString())
    })
  })
}

async function createFundFromFixture (web3Chain, fixture, principal_, amount) {
  const currentTime = Math.floor(new Date().getTime() / 1000)
  const agentPrincipalAddress = await getAgentAddress(server)
  const address = await getWeb3Address(web3Chain)
  const fundParams = fixture(currentTime, principal_)
  const { principal, fundExpiry, liquidationRatio, interest, penalty, fee } = fundParams
  const [token, funds] = await getTestObjects(web3Chain, principal, ['erc20', 'funds'])
  const unit = currencies[principal].unit
  const amountToDeposit = toWei(amount.toString(), unit)
  await fundTokens(address, amountToDeposit, principal)

  const { body } = await chai.request(server).post('/funds/new').send(fundParams)
  const { id: fundModelId } = body

  const fundId = await checkFundCreated(fundModelId)

  await token.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send({ gas: 500000 })
  await funds.methods.deposit(numToBytes32(fundId), amountToDeposit).send({ gas: 2000000 })

  return { fundId, fundParams, agentAddress: agentPrincipalAddress, amountDeposited: amountToDeposit }
}

async function testSetup (web3Chain) {
  const address = await getWeb3Address(web3Chain)
  rewriteEnv('.env', 'ETH_SIGNER', address)
  await cancelLoans(web3Chain)
  await cancelJobs()
  rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
  await removeFunds()
  await fundAgent(server)
  await fundArbiter()
  await generateSecretHashesArbiter('DAI')
  await fundWeb3Address(web3Chain)
}

describe('Lender Agent - Funds', () => {
  describe('Web3HDWallet / BitcoinJs', () => {
    beforeEach(async function () { await testSetup(chains.web3WithHDWallet) })
    testFunds(chains.web3WithHDWallet)
  })

  // describe('MetaMask / Ledger', () => {
  //   connectMetaMask()
  //   beforeEach(async function () { await testSetup(chains.web3WithMetaMask, chains.bitcoinWithLedger) })
  //   testFunds(chains.web3WithMetaMask, chains.bitcoinWithLedger)
  // })

  // describe('MetaMask / BitcoinJs', () => {
  //   connectMetaMask()
  //   beforeEach(async function () { await testSetup(chains.web3WithMetaMask, chains.bitcoinWithJs) })
  //   testFunds(chains.web3WithMetaMask, chains.bitcoinWithJs)
  // })
})
