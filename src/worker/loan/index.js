const Loan = require('../../models/Loan')
const LoanMarket = require('../../models/LoanMarket')
const Market = require('../../models/Market')
const EthTransaction = require('../../models/EthTransaction')
const { numToBytes32 } = require('../../utils/finance')
const { loadObject } = require('../../utils/contracts')
const { ensure0x, remove0x } = require('@liquality/ethereum-utils')
const keccak256 = require('keccak256')
const { currencies } = require('../../utils/fx')
const clients = require('../../utils/clients')
const BN = require('bignumber.js')
const web3 = require('../../utils/web3')
const { toWei, fromWei, hexToNumber, hexToAscii } = web3.utils

async function requestLoan (txParams, loan, agenda, done) {
  console.log('requestLoan txParams: ', txParams)
  web3.eth.sendTransaction(txParams)
  .on('transactionHash', (transactionHash) => {
    loan.loanRequestTxHash = transactionHash
    loan.status = 'REQUESTING'
    loan.save()
    console.log('LOAN REQUESTING')
  })
  .on('confirmation', async (confirmationNumber, receipt) => {
    const { principal, collateral, collateralAmount } = loan
    const { loanMarket, market } = await getMarketModels(principal, collateral)
    const { minConf } = loanMarket
    const { rate } = market

    if (confirmationNumber === minConf) {
      const loanCreateLog = receipt.logs.filter(log => log.topics[0] === ensure0x(keccak256('Create(bytes32)').toString('hex')))

      if (loanCreateLog.length > 0) {
        const { data: loanId } = loanCreateLog[0]

        const loans = await loadObject('loans', process.env[`${principal}_LOAN_LOANS_ADDRESS`])

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
      } else {
        console.error('Error: Loan Id could not be found in transaction logs')
      }
    }
  })
  .on('error', (error) => {
    console.log(error)
    done()
  })
}

function defineLoanJobs (agenda) {
  agenda.define('request-loan', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    console.log('request-loan data:', data)

    const loan = await Loan.findOne({ _id: requestId }).exec()
    if (!loan) return console.log('Error: Loan not found')
    const {
      principal, collateral, principalAmount, collateralAmount, borrowerPrincipalAddress, borrowerSecretHashes, lenderSecretHashes,
      lenderPrincipalAddress, requestLoanDuration, borrowerCollateralPublicKey, lenderCollateralPublicKey
    } = loan

    const funds = await loadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`])

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

    const txData = funds.methods.request(...loanParams).encodeABI()

    const txParams = {
      from: ensure0x(lenderPrincipalAddress),
      to: process.env[`${principal}_LOAN_FUNDS_ADDRESS`],
      data: txData
    }

    const [ nonce, gasPrice, gasLimit ] = await Promise.all([
      web3.eth.getTransactionCount(ensure0x(lenderPrincipalAddress)),
      web3.eth.getGasPrice(),
      web3.eth.estimateGas(txParams)
    ])

    txParams.nonce = nonce
    txParams.gasPrice = gasPrice
    txParams.gasLimit = gasLimit + 1000000

    console.log('txParams', txParams)

    const ethTransaction = EthTransaction.fromTxParams(txParams)
    await ethTransaction.save()

    await agenda.schedule('in 2 minutes', 'verify-request-loan', { ethTransactionId: ethTransaction.id, loanId: loan.id })

    await requestLoan(txParams, loan, agenda, done)
  })

  agenda.define('verify-request-loan', async (job, done) => {
    const { data } = job.attrs
    const { ethTransactionId, loanId } = data

    console.log('verify-request loan')

    const ethTransaction = await EthTransaction.findOne({ _id: ethTransactionId }).exec()
    if (!ethTransaction) return console.log('Error: EthTransaction not found')

    const loan = await Loan.findOne({ _id: loanId }).exec()
    if (!loan) return console.log('Error: Loan not found')

    await requestLoan(ethTransaction, loan, agenda, done)
  })

  agenda.define('verify-lock-collateral', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    console.log('data', data)

    const loan = await Loan.findOne({ _id: requestId }).exec()
    if (!loan) return console.log('Error: Loan not found')

    if (loan.status === 'CANCELLED' || loan.status === 'CANCELLING') { done() } // Don't check if collateral locked if in the middle of canceling loan

    const { collateral, collateralRefundableP2SHAddress, collateralSeizableP2SHAddress, refundableCollateralAmount, seizableCollateralAmount, lenderPrincipalAddress } = loan

    const refundableBalance = await loan.collateralClient().chain.getBalance([collateralRefundableP2SHAddress])
    const seizableBalance = await loan.collateralClient().chain.getBalance([collateralSeizableP2SHAddress])

    const refundableUnspent = await loan.collateralClient().getMethod('getUnspentTransactions')([collateralRefundableP2SHAddress])
    const seizableUnspent = await loan.collateralClient().getMethod('getUnspentTransactions')([collateralSeizableP2SHAddress])

    const collateralRequirementsMet = (refundableBalance.toNumber() >= refundableCollateralAmount && seizableBalance.toNumber() >= seizableCollateralAmount)
    const refundableConfirmationRequirementsMet = refundableUnspent.length === 0 ? false : refundableUnspent[0].confirmations > 0
    const seizableConfirmationRequirementsMet = seizableUnspent.length === 0 ? false : seizableUnspent[0].confirmations > 0

    if (collateralRequirementsMet && refundableConfirmationRequirementsMet && seizableConfirmationRequirementsMet) {
      const { loanId, principal } = loan

      console.log('COLLATERAL LOCKED')

      await agenda.now('approve-loan', { requestId: loan.id })
    } else {
      console.log('COLLATERAL NOT LOCKED')
      // TODO: should not schedule if after approveExpiration
      // TODO: add reason for canceling (for example, cancelled because collateral wasn't sufficient)
      // TODO: check current blocktime
      agenda.schedule('in 5 seconds', 'verify-lock-collateral', { requestId: requestId })
      console.log('rescheduled')
    }

    done()
  })

  agenda.define('approve-loan', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    console.log('data', data)

    const loan = await Loan.findOne({ _id: requestId }).exec()
    if (!loan) return console.log('Error: Loan not found')

    const { loanId, principal, collateral, lenderPrincipalAddress } = loan

    const { loanMarket } = await getMarketModels(principal, collateral)
    const { minConf } = loanMarket

    const loans = await loadObject('loans', process.env[`${principal}_LOAN_LOANS_ADDRESS`])

    const approved = await loans.methods.approved(numToBytes32(loanId)).call()

    if (approved) {
      console.log('Loan already approved')
      done()
    } else {
      loans.methods.approve(numToBytes32(loanId)).send({ from: ensure0x(lenderPrincipalAddress), gas: 1000000 })
      .on('transactionHash', (transactionHash) => {
        loan.approveTxHash = transactionHash
        console.log('APPROVING')
        loan.status = 'APPROVING'
        loan.save()
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === minConf) {
          console.log('receipt', receipt)
          console.log('APPROVED')
          loan.status = 'APPROVED'
          loan.save()
          done()
        }
      })
      .on('error', (error) => {
        console.log(error)
        done()
      })

      done()
    }
  })

  agenda.define('check-loan-repaid', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    // TODO: complete check loan repaid
  })

  agenda.define('accept-or-cancel-loan', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    console.log('data', data)

    const loan = await Loan.findOne({ _id: requestId }).exec()
    if (!loan) return console.log('Error: Loan not found')

    const { loanId, principal, collateral, lenderPrincipalAddress, lenderSecrets } = loan

    const { loanMarket } = await getMarketModels(principal, collateral)
    const { minConf } = loanMarket

    const loans = await loadObject('loans', process.env[`${principal}_LOAN_LOANS_ADDRESS`])
    const { off, paid, withdrawn } = await loans.methods.bools(numToBytes32(loanId)).call()

    // TODO: reformat console.log statements
    if (!off && (!withdrawn || paid)) {
      loans.methods.accept(numToBytes32(loanId), ensure0x(lenderSecrets[0])).send({ from: ensure0x(lenderPrincipalAddress), gas: 1000000 })
      .on('transactionHash', (transactionHash) => {
        if (paid) {
          console.log('ACCEPTING')
          loan.status = 'ACCEPTING'
        } else {
          console.log('CANCELLING')
          loan.status = 'CANCELLING'
        }

        loan.save()
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === minConf) {
          console.log('receipt', receipt)
          if (paid) {
            console.log('ACCEPTED')
            loan.status = 'ACCEPTED'
          } else {
            console.log('CANCELLED')
            loan.status = 'CANCELLED'
          }

          loan.save()
          done()
        }
      })
      .on('error', (error) => {
        console.log(error)
        done()
      })

      done()
    } else {
      console.log(`Loan wasn't accepted or cancelled because off: ${off}, withdrawn: ${withdrawn}, paid: ${paid}}`)
    }
  })
}

async function getMarketModels (principal, collateral) {
  const loanMarket = await LoanMarket.findOne({ principal, collateral }).exec()
  if (!loanMarket) return console.log('Error: Loan Market not found')

  const market = await Market.findOne({ from: collateral, to: principal }).exec()
  if (!market) return console.log('Error: Market not found')

  return { loanMarket, market }
}

module.exports = {
  defineLoanJobs
}
