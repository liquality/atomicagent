/* eslint-env mocha */
require('dotenv').config()
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')
const { ensure0x, remove0x, checksumEncode } = require('@liquality/ethereum-utils')
const { sha256 } = require('@liquality/crypto')
const toSecs = require('@mblackmblack/to-seconds')
const bitcoin = require('bitcoinjs-lib')
const { chains, connectMetaMask, importBitcoinAddresses, importBitcoinAddressesByAddress, fundUnusedBitcoinAddress, rewriteEnv } = require('../common')
const { fundArbiter, generateSecretHashesArbiter, getLockParams, getTestObject, cancelLoans, fundWeb3Address } = require('./lenderCommon')
const { getWeb3Address } = require('./util/web3Helpers')
const web3 = require('../../src/utils/web3')
const { toWei, fromWei, numberToHex } = web3.utils
const { testLoadObject } = require('./util/contracts')
const { loadObject } = require('../../src/utils/contracts')
const { currencies } = require('../../src/utils/fx')
const { numToBytes32, rateToSec } = require('../../src/utils/finance')
const { sleep } = require('../../src/utils/async')
const { generateMnemonic } = require('bip39')

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const lenderServer = 'http://localhost:3030/api/loan'
const arbiterServer = 'http://localhost:3032/api/loan'

const arbiterChain = chains.web3WithArbiter

function testLenderAgent (web3Chain, btcChain) {
  describe('loanmarketinfo', () => {
    describe('/GET loanmarketinfo', () => {
      it('should GET all the loan markets', (done) => {
        chai.request(lenderServer)
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
        const { body: loanMarkets } = await chai.request(lenderServer).get('/loanmarketinfo')
        const { body: addresses } = await chai.request(lenderServer).get(`/agentinfo/${loanMarkets[0].id}`)
        const { principalAddress } = addresses

        expect(principalAddress.length / 2).to.equal(21)
      })
    })

    describe('Withdraw excess funds', () => {
      it('should return eth to metamask user if ETH_SIGNER', async () => {
        const timestamp = Math.floor(new Date().getTime() / 1000)
        const amount = 1
        const currency = 'ETH'
        const address = await getWeb3Address(web3Chain)
        const message = `Withdraw ${amount} ${currency} to ${address} at ${timestamp}`

        await chains.ethereumWithNode.client.chain.sendTransaction(address, toWei(amount.toString(), 'ether'))

        const signature = await web3Chain.client.eth.personal.sign(message, address)
        const balanceBefore = await chains.ethereumWithNode.client.chain.getBalance(address)

        await chai.request(lenderServer).post('/withdraw').send({ currency, timestamp, signature, amount, message })

        const balanceAfter = await chains.ethereumWithNode.client.chain.getBalance(address)

        expect(BN(balanceAfter).toFixed()).to.equal(BN(balanceBefore).plus(BN(toWei(amount.toString(), 'ether'))).toFixed())
      })
    })

    describe('Create Custom Loan Fund', () => {
      before(async function () {
        await fundArbiter()
        await generateSecretHashesArbiter('DAI')
      })

      it('should create a new loan fund and deposit funds into it', async () => {
        const currentTime = Math.floor(new Date().getTime() / 1000)

        const collateral = 'BTC'
        const principal = 'DAI'
        const custom = true
        const arbiter = await getWeb3Address(arbiterChain)

        console.log('create custom loan fund arbiter', arbiter)

        const compoundEnabled = false
        const amount = 0
        const maxLoanDuration = 0
        const maxFundDuration = currentTime + toSecs({ days: 100 })
        const liquidationRatio = 150 // 150% collateralization ratio
        const interest = 16.5 // 16.5% APR
        const penalty = 3 // 3% APR
        const fee = 0.75 // 0.75% APR

        const unit = currencies[principal].unit
        const amountToDeposit = toWei('200', unit)

        const { body: loanMarkets } = await chai.request(lenderServer).get('/loanmarketinfo')
        const { body: addresses } = await chai.request(lenderServer).get(`/agentinfo/${loanMarkets[0].id}`)
        const { principalAddress } = addresses

        await chains.ethereumWithNode.client.chain.sendTransaction(principalAddress, toWei('1', 'ether'))

        const { body } = await chai.request(lenderServer).post('/funds/new').send({
          collateral, principal, custom, arbiter, compoundEnabled, amount, maxLoanDuration, maxFundDuration, liquidationRatio, interest, penalty, fee
        })
        const { fundId } = body

        const address = await getWeb3Address(web3Chain)

        const { address: ethereumWithNodeAddress } = await chains.ethereumWithNode.client.wallet.getUnusedAddress()

        const token = await testLoadObject('erc20', process.env[`${principal}_ADDRESS`], chains.web3WithNode, ensure0x(ethereumWithNodeAddress))
        await token.methods.transfer(address, amountToDeposit).send({ gas: 6000000 })

        const testToken = await getTestObject(web3Chain, 'erc20', principal)
        await testToken.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send({ gas: 6000000 })

        console.log(`Depositing ${principal} to Loan Fund`)

        const testFunds = await getTestObject(web3Chain, 'funds', principal)
        await testFunds.methods.deposit(numToBytes32(fundId), amountToDeposit).send({ gas: 6000000 })

        const {
          lender, maxLoanDur, maxFundDur, interest: actualInterest, penalty: actualPenalty, fee: actualFee, liquidationRatio: actualLiquidationRatio, balance
        } = await testFunds.methods.funds(numToBytes32(fundId)).call()

        const fundStruct = await testFunds.methods.funds(numToBytes32(fundId)).call()
        console.log(`Deposited Funds to Loan Fund: ${fundId}`, fundStruct)

        console.log('Loan Fund', fundId, 'Balance:', fromWei(balance, unit), principal)

        expect(fromWei(balance, 'wei')).to.equal(amountToDeposit)

        expect(lender).to.equal(checksumEncode(principalAddress))
        expect(maxLoanDur).to.equal(BN(2).pow(256).minus(1).toFixed())
        expect(maxFundDur).to.equal(maxFundDuration.toString())
        expect(actualLiquidationRatio).to.equal(toWei((liquidationRatio / 100).toString(), 'gether'))
        expect(actualInterest).to.equal(toWei(rateToSec(interest.toString()), 'gether'))
        expect(actualPenalty).to.equal(toWei(rateToSec(penalty.toString()), 'gether'))
        expect(actualFee).to.equal(toWei(rateToSec(fee.toString()), 'gether'))
      })
    })

    describe('E2E Tests', () => {
      before(async function () {
        await fundArbiter()
        await generateSecretHashesArbiter('DAI')
      })

      it('should POST loanMarket details and return loan details', async () => {
        const principal = 'DAI'
        const collateral = 'BTC'
        const principalAmount = 25
        const loanDuration = toSecs({ days: 2 })

        const { status: requestsStatus, body: requestsBody } = await chai.request(lenderServer).post('/loans/new').send({ principal, collateral, principalAmount, loanDuration })

        expect(requestsStatus).to.equal(200)
        requestsBody.should.be.a('object')

        const { id: requestId, lenderPrincipalAddress, lenderCollateralPublicKey, minimumCollateralAmount, requestCreatedAt } = requestsBody

        const borrowerPrincipalAddress = await getWeb3Address(web3Chain)

        const { address, publicKey: borrowerCollateralPublicKey } = await btcChain.client.wallet.getUnusedAddress()
        const collateralValue = Math.floor(BN(minimumCollateralAmount).times(currencies[collateral].multiplier).times(1.2).toNumber())

        const currentTime = Date.now()

        const data = Buffer.from(`${lenderCollateralPublicKey} ${principalAmount} ${principal} ${currentTime}`, 'utf8')
        const dataScript = bitcoin.payments.embed({ data: [data] })

        const proofOfFundsTxHex = await btcChain.client.chain.buildBatchTransaction([{ to: address, value: collateralValue }, { to: dataScript.output, value: 0 }])

        const secretData = [
          toWei(principalAmount.toString(), currencies[principal].unit), // Principal Value
          principal, // Principal
          collateralValue, // Collateral Value
          collateral, // Collateral
          borrowerPrincipalAddress, // Borrower Principal Address
          lenderPrincipalAddress, // Lender Principal Address
          borrowerCollateralPublicKey, // Borrower Collateral PubKey
          lenderCollateralPublicKey, // Lender Collateral PubKey
          requestCreatedAt // Fund Id as number
        ]

        const secretMsg = secretData.join('')
        const secrets = await btcChain.client.loan.secrets.generateSecrets(secretMsg, 4)
        const secretHashes = secrets.map(secret => sha256(secret))

        const { status: requestsIdStatus, body: requestsIdBody } = await chai.request(lenderServer).post(`/loans/${requestId}/proof_of_funds`).send({
          proofOfFundsTxHex, borrowerSecretHashes: secretHashes, borrowerPrincipalAddress, borrowerCollateralPublicKey: borrowerCollateralPublicKey.toString('hex')
        })
        const {
          collateralAmount: collateralAmountActual, borrowerPrincipalAddress: borrowerPrincipalAddressActual, borrowerCollateralPublicKey: borrowerCollateralPublicKeyActual
        } = requestsIdBody

        expect(requestsIdStatus).to.equal(200)
        requestsIdBody.should.be.a('object')
        expect(BN(collateralAmountActual).times(currencies[collateral].multiplier).toNumber()).to.equal(collateralValue)
        expect(borrowerPrincipalAddressActual).to.equal(borrowerPrincipalAddress)
        expect(borrowerCollateralPublicKeyActual).to.equal(borrowerCollateralPublicKey.toString('hex'))

        console.log('requestsIdBody', requestsIdBody)

        let requested = false
        while (!requested) {
          await sleep(5000)
          let { body: requestedBody } = await chai.request(lenderServer).get(`/loans/${requestId}`)
          const { status } = requestedBody
          console.log('status', status)
          if (status === 'AWAITING_COLLATERAL') requested = true
        }

        console.log('awaiting collateral')

        const { body: requestedBody } = await chai.request(lenderServer).get(`/loans/${requestId}`)

        const { loanId, refundableCollateralAmount, seizableCollateralAmount, collateralRefundableP2SHAddress, collateralSeizableP2SHAddress } = requestedBody

        const values = {
          refundableValue: BN(refundableCollateralAmount).times(currencies[collateral].multiplier).toNumber(),
          seizableValue: BN(seizableCollateralAmount).times(currencies[collateral].multiplier).toNumber()
        }

        console.log('values', values)

        await importBitcoinAddressesByAddress([collateralRefundableP2SHAddress, collateralSeizableP2SHAddress])

        const loans = await getTestObject(web3Chain, 'loans', principal)
        const approvedBefore = await loans.methods.approved(numToBytes32(loanId)).call()
        console.log('approvedBefore', approvedBefore)

        const funded = await loans.methods.funded(numToBytes32(loanId)).call()
        console.log('funded', funded)

        console.log('10s')
        await sleep(5000)
        console.log('5s')
        await sleep(5000)
        console.log('0s')

        const lockParams = await getLockParams(web3Chain, principal, values, loanId)
        const tx = await btcChain.client.loan.collateral.lock(...lockParams)
        console.log('tx', tx)

        const balance = await btcChain.client.chain.getBalance([collateralRefundableP2SHAddress, collateralSeizableP2SHAddress])
        console.log('balance', balance)

        console.log('10s')
        await sleep(5000)
        console.log('5s')
        await sleep(5000)
        console.log('0s')

        await chains.bitcoinWithNode.client.chain.generateBlock(1)

        console.log('10s')
        await sleep(5000)
        console.log('5s')
        await sleep(5000)
        console.log('0s')

        const approvedAfter = await loans.methods.approved(numToBytes32(loanId)).call()
        console.log('approvedAfter', approvedAfter)

        const withdrawTx = await loans.methods.withdraw(numToBytes32(loanId), ensure0x(secrets[0])).send({ gas: 6000000 })
        console.log('withdrawTx', withdrawTx)

        const owedForLoan = await loans.methods.owedForLoan(numToBytes32(loanId)).call()
        console.log('owedForLoan')

        const web3Address = await getWeb3Address(web3Chain)
        const { address: ethereumWithNodeAddress } = await chains.ethereumWithNode.client.wallet.getUnusedAddress()

        const token = await testLoadObject('erc20', process.env[`${principal}_ADDRESS`], chains.web3WithNode, ensure0x(ethereumWithNodeAddress))
        await token.methods.transfer(web3Address, toWei(owedForLoan, 'wei')).send({ gas: 6000000 })

        const testToken = await getTestObject(web3Chain, 'erc20', principal)
        await testToken.methods.approve(process.env[`${principal}_LOAN_LOANS_ADDRESS`], toWei(owedForLoan, 'wei')).send({ gas: 6000000 })

        const repayTx = await loans.methods.repay(numToBytes32(loanId), owedForLoan).send({ gas: 6000000 })
        console.log('repayTx', repayTx)
      })
    })
  })
}

describe('Lender Agent', () => {
  describe('Web3HDWallet / BitcoinJs', () => {
    before(async function () {
      await importBitcoinAddresses(chains.bitcoinWithJs)
      await fundUnusedBitcoinAddress(chains.bitcoinWithJs)
      await fundWeb3Address(chains.web3WithHDWallet)
      const address = await getWeb3Address(chains.web3WithHDWallet)
      rewriteEnv('.env', 'ETH_SIGNER', address)
      await cancelLoans(chains.web3WithHDWallet)
      rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
    })
    testLenderAgent(chains.web3WithHDWallet, chains.bitcoinWithJs)
  })

  describe('MetaMask / Ledger', () => {
    connectMetaMask()
    before(async function () {
      await importBitcoinAddresses(chains.bitcoinWithLedger)
      await fundUnusedBitcoinAddress(chains.bitcoinWithLedger)
      await fundWeb3Address(chains.web3WithMetaMask)
      const address = await getWeb3Address(chains.web3WithMetaMask)
      rewriteEnv('.env', 'ETH_SIGNER', address)
      await cancelLoans(chains.web3WithMetaMask)
      rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
    })
    testLenderAgent(chains.web3WithMetaMask, chains.bitcoinWithLedger)
  })

  describe('MetaMask / BitcoinJs', () => {
    connectMetaMask()
    before(async function () {
      await importBitcoinAddresses(chains.bitcoinWithJs)
      await fundUnusedBitcoinAddress(chains.bitcoinWithJs)
      await fundWeb3Address(chains.web3WithMetaMask)
      const address = await getWeb3Address(chains.web3WithMetaMask)
      rewriteEnv('.env', 'ETH_SIGNER', address)
      await cancelLoans(chains.web3WithMetaMask)
      rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
    })
    testLenderAgent(chains.web3WithMetaMask, chains.bitcoinWithJs)
  })
})
