/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')
const toSecs = require('@mblackmblack/to-seconds')
const { ensure0x, checksumEncode } = require('@liquality/ethereum-utils')
const { generateMnemonic } = require('bip39')

const { chains, connectMetaMask, importBitcoinAddresses, fundUnusedBitcoinAddress, rewriteEnv } = require('../../common')
const { fundArbiter, fundAgent, fundTokens, getAgentAddress, generateSecretHashesArbiter, getTestObject, getTestObjects, cancelLoans, fundWeb3Address } = require('../loanCommon')
const fundFixtures = require('./fixtures/fundFixtures')
const { getWeb3Address } = require('../util/web3Helpers')
const { currencies } = require('../../../src/utils/fx')
const { numToBytes32, rateToSec } = require('../../../src/utils/finance')
const { testLoadObject } = require('../util/contracts')
const { sleep } = require('../../../src/utils/async')
const { checkFundCreated } = require('./setup/fundSetup')
const web3 = require('../../../src/utils/web3')
const { toWei, fromWei } = web3.utils

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

const arbiterChain = chains.web3WithArbiter

function testFunds (web3Chain, btcChain) {
  describe('Create Custom Loan Fund', () => {
    it('should create a new loan fund and deposit funds into it', async () => {
      const currentTime = Math.floor(new Date().getTime() / 1000)
      const agentPrincipalAddress = await getAgentAddress(server)
      const address = await getWeb3Address(web3Chain)
      const arbiter = await getWeb3Address(arbiterChain)
      const fundParams = fundFixtures.customDAIFundWithFundExpiryIn100Days(currentTime)
      const { principal, fundExpiry, liquidationRatio, interest, penalty, fee } = fundParams
      const [ token, funds ] = await getTestObjects(web3Chain, principal, ['erc20', 'funds'])
      const unit = currencies[principal].unit
      const amountToDeposit = toWei('200', unit)
      await fundTokens(address, amountToDeposit, principal)

      const { body } = await chai.request(server).post('/funds/new').send(fundParams)
      const { id: fundModelId } = body

      const fundId = await checkFundCreated(fundModelId)

      await token.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send({ gas: 100000 })
      await funds.methods.deposit(numToBytes32(fundId), amountToDeposit).send({ gas: 100000 })

      const {
        lender, maxLoanDur, fundExpiry: actualFundExpiry, interest: actualInterest, penalty: actualPenalty, fee: actualFee, liquidationRatio: actualLiquidationRatio, balance
      } = await funds.methods.funds(numToBytes32(fundId)).call()

      expect(fromWei(balance, 'wei')).to.equal(amountToDeposit)
      expect(lender).to.equal(checksumEncode(agentPrincipalAddress))
      expect(maxLoanDur).to.equal(BN(2).pow(256).minus(1).toFixed())
      expect(actualFundExpiry).to.equal(fundExpiry.toString())
      expect(actualLiquidationRatio).to.equal(toWei((liquidationRatio / 100).toString(), 'gether'))
      expect(actualInterest).to.equal(toWei(rateToSec(interest.toString()), 'gether'))
      expect(actualPenalty).to.equal(toWei(rateToSec(penalty.toString()), 'gether'))
      expect(actualFee).to.equal(toWei(rateToSec(fee.toString()), 'gether'))
    })
  })
}

async function testSetup (web3Chain, btcChain) {
  await fundAgent(server)
  await fundArbiter()
  await generateSecretHashesArbiter('DAI')
  await importBitcoinAddresses(btcChain)
  await fundUnusedBitcoinAddress(btcChain)
  await fundWeb3Address(web3Chain)
  const address = await getWeb3Address(web3Chain)
  rewriteEnv('.env', 'ETH_SIGNER', address)
  await cancelLoans(web3Chain)
  rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
}

describe('Lender Agent - Funds', () => {
  describe.only('Web3HDWallet / BitcoinJs', () => {
    before(async function () { await testSetup(chains.web3WithHDWallet, chains.bitcoinWithJs) })
    testFunds(chains.web3WithHDWallet, chains.bitcoinWithJs)
  })

  describe('MetaMask / Ledger', () => {
    connectMetaMask()
    before(async function () { await testSetup(chains.web3WithMetaMask, chains.bitcoinWithLedger) })
    testFunds(chains.web3WithMetaMask, chains.bitcoinWithLedger)
  })

  describe('MetaMask / BitcoinJs', () => {
    connectMetaMask()
    before(async function () { await testSetup(chains.web3WithMetaMask, chains.bitcoinWithJs) })
    testFunds(chains.web3WithMetaMask, chains.bitcoinWithJs)
  })
})
