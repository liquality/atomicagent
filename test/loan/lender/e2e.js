/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')
const toSecs = require('@mblackmblack/to-seconds')
const bitcoin = require('bitcoinjs-lib')
const { ensure0x } = require('@liquality/ethereum-utils')
const { generateMnemonic } = require('bip39')
const { sha256 } = require('@liquality/crypto')

const { chains, connectMetaMask, importBitcoinAddresses, importBitcoinAddressesByAddress, fundUnusedBitcoinAddress, rewriteEnv } = require('../../common')
const { fundArbiter, fundAgent, generateSecretHashesArbiter, getLockParams, getTestObject, cancelLoans, fundWeb3Address, cancelJobs, removeFunds } = require('../loanCommon')
const { getWeb3Address } = require('../util/web3Helpers')
const { currencies } = require('../../../src/utils/fx')
const { numToBytes32 } = require('../../../src/utils/finance')
const { testLoadObject } = require('../util/contracts')
const { sleep } = require('../../../src/utils/async')
const { createCustomFund } = require('./setup/fundSetup')
const web3 = require('web3')

const { toWei } = web3.utils

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

const arbiterChain = chains.web3WithArbiter

function testE2E (web3Chain, btcChain) {
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

      const { status: requestsStatus, body: requestsBody } = await chai.request(server).post('/loans/new').send({ principal, collateral, principalAmount, loanDuration })

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

      const { status: requestsIdStatus, body: requestsIdBody } = await chai.request(server).post(`/loans/${requestId}/proof_of_funds`).send({
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

      let requested = false
      while (!requested) {
        await sleep(5000)
        const { body: requestedBody } = await chai.request(server).get(`/loans/${requestId}`)
        const { status } = requestedBody
        console.log('status', status)
        if (status === 'AWAITING_COLLATERAL') requested = true
      }

      const { body: requestedBody } = await chai.request(server).get(`/loans/${requestId}`)

      const { loanId, refundableCollateralAmount, seizableCollateralAmount, collateralRefundableP2SHAddress, collateralSeizableP2SHAddress } = requestedBody

      const values = {
        refundableValue: BN(refundableCollateralAmount).times(currencies[collateral].multiplier).toNumber(),
        seizableValue: BN(seizableCollateralAmount).times(currencies[collateral].multiplier).toNumber()
      }

      await importBitcoinAddressesByAddress([collateralRefundableP2SHAddress, collateralSeizableP2SHAddress])

      const loans = await getTestObject(web3Chain, 'loans', principal)
      const approvedBefore = await loans.methods.approved(numToBytes32(loanId)).call()
      expect(approvedBefore).to.equal(false)

      const funded = await loans.methods.funded(numToBytes32(loanId)).call()
      expect(funded).to.equal(true)

      await secondsCountDown(4)

      const expectedAwaitingCollateralStatus = await getLoanStatus(requestId)
      expect(expectedAwaitingCollateralStatus).to.equal('AWAITING_COLLATERAL')

      const lockParams = await getLockParams(web3Chain, principal, values, loanId)
      const tx = await btcChain.client.loan.collateral.lock(...lockParams)
      console.log('tx', tx)

      const balance = await btcChain.client.chain.getBalance([collateralRefundableP2SHAddress, collateralSeizableP2SHAddress])
      console.log('balance', balance)

      await secondsCountDown(4)

      console.log('Mine BTC Block')
      await chains.bitcoinWithNode.client.chain.generateBlock(1)

      await secondsCountDown(10)

      const approvedAfter = await loans.methods.approved(numToBytes32(loanId)).call()
      expect(approvedAfter).to.equal(true)

      const withdrawTx = await loans.methods.withdraw(numToBytes32(loanId), ensure0x(secrets[0])).send({ gas: 100000 })

      const owedForLoan = await loans.methods.owedForLoan(numToBytes32(loanId)).call()

      const web3Address = await getWeb3Address(web3Chain)
      const { address: ethereumWithNodeAddress } = await chains.ethereumWithNode.client.wallet.getUnusedAddress()

      const token = await testLoadObject('erc20', process.env[`${principal}_ADDRESS`], chains.web3WithNode, ensure0x(ethereumWithNodeAddress))
      await token.methods.transfer(web3Address, toWei(owedForLoan, 'wei')).send({ gas: 100000 })

      const testToken = await getTestObject(web3Chain, 'erc20', principal)
      await testToken.methods.approve(process.env[`${principal}_LOAN_LOANS_ADDRESS`], toWei(owedForLoan, 'wei')).send({ gas: 100000 })

      const repayTx = await loans.methods.repay(numToBytes32(loanId), owedForLoan).send({ gas: 100000 })
    })
  })
}

async function secondsCountDown (num) {
  for (let i = num; i >= 0; i--) {
    console.log(`${i}s`)
    await sleep(1000)
  }
}

async function getLoanStatus (loanId) {
  const { body } = await chai.request(server).get(`/loans/${loanId}`)
  return body.status
}

async function testSetup (web3Chain, btcChain) {
  const address = await getWeb3Address(web3Chain)
  rewriteEnv('.env', 'ETH_SIGNER', address)
  await cancelLoans(web3Chain)
  rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
  await cancelJobs()
  await removeFunds()
  await fundAgent(server)
  await fundArbiter()
  await generateSecretHashesArbiter('DAI')
  await importBitcoinAddresses(btcChain)
  await fundUnusedBitcoinAddress(btcChain)
  await fundWeb3Address(web3Chain)
  await createCustomFund(web3Chain, arbiterChain, 200, 'DAI') // Create Custom Loan Fund with 200 DAI
}

describe('Lender Agent - Funds', () => {
  describe.only('Web3HDWallet / BitcoinJs', () => {
    before(async function () { await testSetup(chains.web3WithHDWallet, chains.bitcoinWithJs) })
    testE2E(chains.web3WithHDWallet, chains.bitcoinWithJs)
  })

  describe('MetaMask / BitcoinJs', () => {
    connectMetaMask()
    before(async function () { await testSetup(chains.web3WithMetaMask, chains.bitcoinWithJs) })
    testE2E(chains.web3WithMetaMask, chains.bitcoinWithJs)
  })

  describe('MetaMask / Ledger', () => {
    connectMetaMask()
    before(async function () { await testSetup(chains.web3WithMetaMask, chains.bitcoinWithLedger) })
    testE2E(chains.web3WithMetaMask, chains.bitcoinWithLedger)
  })
})
