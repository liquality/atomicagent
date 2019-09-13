const Loan = require('../../models/Loan')
const LoanMarket = require('../../models/LoanMarket')
const Market = require('../../models/Market')
const { numToBytes32 } = require('../../utils/finance')
const { loadObject } = require('../../utils/contracts')
const { ensure0x, remove0x } = require('@liquality/ethereum-utils')
const { currencies } = require('../../utils/fx')
const clients = require('../../utils/clients')
const BN = require('bignumber.js')
const web3 = require('../../utils/web3')
const { toWei, fromWei, hexToNumber, hexToAscii } = web3.utils

function defineLoanJobs (agenda) {
  agenda.define('request-loan', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    console.log('request-loan data:', data)

    const loan = await Loan.findOne({ _id: requestId }).exec()
    if (!loan) return console.log('Error: Loan Request not found')
    const {
      principal, collateral, principalAmount, collateralAmount, borrowerPrincipalAddress, borrowerSecretHashes, lenderSecretHashes,
      lenderPrincipalAddress, requestLoanDuration, borrowerCollateralPublicKey, lenderCollateralPublicKey
    } = loan

    const loanMarket = await LoanMarket.findOne({ principal, collateral }).exec()
    if (!loanMarket) return console.log('Error: Loan Market not found')
    const { minConf } = loanMarket

    const market = await Market.findOne({ from: collateral, to: principal }).exec()
    if (!market) return console.log('Error: Market not found')
    const { rate } = market

    const funds = await loadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`])
    const loans = await loadObject('loans', process.env[`${principal}_LOAN_LOANS_ADDRESS`])

    const fundId = await funds.methods.fundOwner(ensure0x(lenderPrincipalAddress)).call()

    const loanParams = [
      fundId,
      ensure0x(borrowerPrincipalAddress),
      BN(principalAmount).times(currencies[principal].multiplier).toFixed(),
      BN(collateralAmount).times(currencies[collateral].multiplier).toFixed(),
      requestLoanDuration,
      borrowerSecretHashes.concat(lenderSecretHashes).map(secretHashes => ensure0x(secretHashes)),
      ensure0x(borrowerCollateralPublicKey),
      ensure0x(lenderCollateralPublicKey)
    ]

    const loanId = await funds.methods.request(...loanParams).call({ from: ensure0x(lenderPrincipalAddress) })

    funds.methods.request(...loanParams).send({ from: ensure0x(lenderPrincipalAddress), gas: 6000000 })
    .on('transactionHash', (transactionHash) => {
      loan.loanRequestTxHash = transactionHash
      loan.status = 'REQUESTING'
      loan.save()
      console.log('LOAN REQUESTING')
    })
    .on('confirmation', async (confirmationNumber, receipt) => {
      if (confirmationNumber === minConf) {
        console.log('receipt', receipt)
        
        const { borrowerPubKey, lenderPubKey, arbiterPubKey } = await loans.methods.pubKeys(numToBytes32(loanId)).call()
        const { secretHashA1, secretHashB1, secretHashC1 } = await loans.methods.secretHashes(numToBytes32(loanId)).call()
        const approveExpiration = await loans.methods.approveExpiration(numToBytes32(loanId)).call()
        const liquidationExpiration = await loans.methods.liquidationExpiration(numToBytes32(loanId)).call()
        const seizureExpiration = await loans.methods.seizureExpiration(numToBytes32(loanId)).call()

        const pubKeys = { borrowerPubKey: remove0x(borrowerPubKey), lenderPubKey: remove0x(lenderPubKey), agentPubKey: remove0x(arbiterPubKey) }
        const secretHashes = { secretHashA1: remove0x(secretHashA1), secretHashB1: remove0x(secretHashB1), secretHashC1: remove0x(secretHashC1) }
        const expirations = { approveExpiration, liquidationExpiration, seizureExpiration }

        const { refundableAddress, seizableAddress } = await clients[collateral].loan.collateral.getLockAddresses(pubKeys, secretHashes, expirations)

        loan.collateralRefundableP2SHAddress = refundableAddress
        loan.collateralSeizableP2SHAddress = seizableAddress

        const owedForLoanInWei = await loans.methods.owedForLoan(loanId).call()
        const owedForLoan = fromWei(owedForLoanInWei, currencies[principal].unit)

        const seizableCollateral = BN(owedForLoan).dividedBy(rate)
        const refundableCollateral = BN(collateralAmount).minus(seizableCollateral)

        loan.refundableCollateralAmount = refundableCollateral.toFixed(currencies[collateral].decimals)
        loan.seizableCollateralAmount = seizableCollateral.toFixed(currencies[collateral].decimals)
        loan.loanId = hexToNumber(loanId)

        loan.status = 'AWAITING_COLLATERAL'

        loan.save()

        await agenda.now('verify-lock-collateral', { requestId: loan.id })

        done()
      }
    })
    .on('error', (error) => {
      console.log(error)
      done()
    })
  })

  agenda.define('verify-lock-collateral', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    console.log('data', data)

    const loan = await Loan.findOne({ _id: requestId }).exec()
    if (!loan) return console.log('Error: Loan Request not found')

    const { collateral, collateralRefundableP2SHAddress, collateralSeizableP2SHAddress, refundableCollateralAmount, seizableCollateralAmount, lenderPrincipalAddress } = loan

    const refundableBalance = await loan.collateralClient().chain.getBalance([collateralRefundableP2SHAddress])
    const seizableBalance = await loan.collateralClient().chain.getBalance([collateralSeizableP2SHAddress])


    const refundableUnspent = await loan.collateralClient().getMethod('getUnspentTransactions')([collateralRefundableP2SHAddress])
    const seizableUnspent = await loan.collateralClient().getMethod('getUnspentTransactions')([collateralSeizableP2SHAddress])

    console.log('refundableUnspent', refundableUnspent)
    console.log('seizableUnspent', seizableUnspent)


    if (refundableBalance.toNumber() >= refundableCollateralAmount && seizableBalance.toNumber() >= seizableCollateralAmount) {
      const { loanId, principal } = loan

      console.log('COLLATERAL LOCKED')
      const loans = await loadObject('loans', process.env[`${principal}_LOAN_LOANS_ADDRESS`])
      
      const tx = await loans.methods.approve(numToBytes32(loanId)).send({ from: lenderPrincipalAddress, gas: 1000000 })
      const { transactionHash } = tx
      loan.approveTxHash = transactionHash
      loan.status = 'APPROVED'
      loan.save()
      console.log('APPROVED')
    } else {
      console.log('COLLATERAL NOT LOCKED')
      agenda.schedule('in 5 seconds', 'verify-lock-collateral', { requestId: requestId })
      console.log('rescheduled')
    }

    done()
  })
}

module.exports = {
  defineLoanJobs
}
