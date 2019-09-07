/* eslint-env mocha */
require('dotenv').config()
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')
const { checksumEncode } = require('@liquality/ethereum-utils')
const toSecs = require('@mblackmblack/to-seconds')
const { chains, connectMetaMask } = require('../common')
const web3 = require('../../src/utils/web3')
const { toWei, fromWei, numberToHex } = web3.utils
const { testLoadObject } = require('./util/contracts')
const { loadObject } = require('../../src/utils/contracts')
const { currencies } = require('../../src/utils/fx')

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

describe('loanmarketinfo', () => {
  describe('/GET loanmarketinfo', () => {
    it('should GET all the loan markets', (done) => {
      chai.request(server)
        .get('/loanmarketinfo')
        .end((_, res) => {
          res.should.have.status(200)
          res.body.should.be.a('array')
          res.body.length.should.be.eql(2)
          done()
        })
    })
  })

  describe('/GET agentinfo/:marketId', () => {
    it('should GET current agent addresses from marketId', async () => {
      const { body: loanMarkets } = await chai.request(server).get('/loanmarketinfo')
      const { body: addresses } = await chai.request(server).get(`/agentinfo/${loanMarkets[0].id}`)
      const { principalAddress } = addresses

      expect(principalAddress.length / 2).to.equal(20)
    })
  })

  describe('Withdraw excess funds', () => {
    connectMetaMask()

    it('should return eth to metamask user if ETH_SIGNER', async () => {
      const timestamp = Math.floor(new Date().getTime() / 1000)
      const amount = 1
      const currency = 'ETH'
      const address = checksumEncode((await chains.ethereumWithMetaMask.client.wallet.getAddresses())[0].address)
      const message = `Withdraw ${amount} ${currency} to ${address} at ${timestamp}`

      await chains.ethereumWithNode.client.chain.sendTransaction(address, toWei(amount.toString(), 'ether'))

      const signature = await chains.ethereumWithMetaMask.client.wallet.signMessage(message)
      const balanceBefore = await chains.ethereumWithNode.client.chain.getBalance(address)

      await chai.request(server).post('/withdraw').send({ currency, timestamp, signature, amount, message })

      const balanceAfter = await chains.ethereumWithNode.client.chain.getBalance(address)

      expect(BN(balanceAfter).toFixed()).to.equal(BN(balanceBefore).plus(BN(toWei(amount.toString(), 'ether'))).toFixed())
    })
  })

  describe.only('Create Loan Fund', () => {
    connectMetaMask()

    it('should create a new loan fund and deposit funds into it', async () => {
      const currentTime = Math.floor(new Date().getTime() / 1000)

      const collateral = 'BTC'
      const principal = 'DAI'
      const custom = true
      const arbiter = '0x0000000000000000000000000000000000000000'
      const compoundEnabled = false
      const amount = 0
      const maxLoanDuration = 0
      const maxFundDuration = currentTime + toSecs({ days: 100 })
      const liquidationRatio = 150 // 150% collateralization ratio
      const interest = 16.5 // 16.5% APR
      const penalty = 3 // 3% APR
      const fee = 0.75 // 0.75% APR

      const unit = currencies[principal].unit
      const amountToDeposit = toWei('50', unit)

      const { body: loanMarkets } = await chai.request(server).get('/loanmarketinfo')
      const { body: addresses } = await chai.request(server).get(`/agentinfo/${loanMarkets[0].id}`)
      const { principalAddress } = addresses

      const { body } = await chai.request(server).post('/funds/new').send({
        collateral, principal, custom, arbiter, compoundEnabled, amount, maxLoanDuration, maxFundDuration, liquidationRatio, interest, penalty, fee
      })
      const { fundId } = body

      const address = (await chains.web3WithMetaMask.client.eth.getAccounts())[0]

      const token = await loadObject('erc20', process.env[`${principal}_ADDRESS`])
      await token.methods.transfer(address, amountToDeposit).send({ from: principalAddress })

      const testToken = await testLoadObject('erc20', process.env[`${principal}_ADDRESS`], address)
      await testToken.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send()

      console.log(`Depositing ${principal} to Loan Fund`)

      const testFunds = await testLoadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`], address)
      await testFunds.methods.deposit(numberToHex(fundId), amountToDeposit).send()

      const { balance } = await testFunds.methods.funds(numberToHex(fundId)).call()
      console.log('Loan Fund', fundId, 'Balance:', fromWei(balance, unit), principal)

      expect(fromWei(balance, 'wei')).to.equal(amountToDeposit)
    })
  })
})
