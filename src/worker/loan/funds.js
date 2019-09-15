const Fund = require('../../models/Fund')
const { rateToSec } = require('../../utils/finance')
const { loadObject } = require('../../utils/contracts')
const { ensure0x } = require('@liquality/ethereum-utils')
const keccak256 = require('keccak256')
const { currencies } = require('../../utils/fx')
const { getMarketModels } = require('./utils/models')
const { setTxParams } = require('./utils/web3Transaction')
const web3 = require('../../utils/web3')
const { toWei, hexToNumber } = web3().utils

function defineFundsJobs (agenda) {
  agenda.define('create-custom-fund', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    const fund = await Fund.findOne({ _id: requestId }).exec()
    if (!fund) return console.log('Error: Fund not found')

    const {
      principal, collateral, maxLoanDuration, fundExpiry, compoundEnabled, liquidationRatio, interest, penalty, fee, amountToDepositOnCreate
    } = fund

    const { loanMarket } = await getMarketModels(principal, collateral)
    const { minPrincipal, maxPrincipal, minLoanDuration } = loanMarket
    const { principalAddress: lenderPrincipalAddress } = await loanMarket.getAgentAddresses()

    const fundParams = [
      toWei(minPrincipal.toString(), currencies[principal].unit),
      toWei(maxPrincipal.toString(), currencies[principal].unit),
      minLoanDuration,
      maxLoanDuration,
      fundExpiry,
      toWei((liquidationRatio / 100).toString(), 'gether'), // 150% collateralization ratio
      toWei(rateToSec(interest.toString()), 'gether'), // 16.50%
      toWei(rateToSec(penalty.toString()), 'gether'), //  3.00%
      toWei(rateToSec(fee.toString()), 'gether'), //  0.75%
      process.env.ETH_ARBITER,
      compoundEnabled,
      toWei(amountToDepositOnCreate.toString(), currencies[principal].unit)
    ]

    const funds = await loadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`])
    const txData = funds.methods.createCustom(...fundParams).encodeABI()
    const { txParams, ethTransaction } = await setTxParams(txData, ensure0x(lenderPrincipalAddress), process.env[`${principal}_LOAN_FUNDS_ADDRESS`])

    // TODO
    // await agenda.schedule('in 2 minutes', 'verify-create-custom-fund', { ethTransactionId: ethTransaction.id, fundId: fund.id })

    await createFund(txParams, fund, done)
  })

  agenda.define('create-fund', async (job, done) => {
    const { data } = job.attrs
    const { requestId } = data

    const fund = await Fund.findOne({ _id: requestId }).exec()
    if (!fund) return console.log('Error: Fund not found')

    const { principal, collateral, maxLoanDuration, fundExpiry, compoundEnabled, amountToDepositOnCreate } = fund

    const { loanMarket } = await getMarketModels(principal, collateral)
    const { principalAddress: lenderPrincipalAddress } = await loanMarket.getAgentAddresses()

    const fundParams = [
      maxLoanDuration,
      fundExpiry,
      process.env.ETH_ARBITER,
      compoundEnabled,
      toWei(amountToDepositOnCreate.toString(), currencies[principal].unit)
    ]

    const funds = await loadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`])
    const txData = funds.methods.create(...fundParams).encodeABI()
    const { txParams, ethTransaction } = await setTxParams(txData, ensure0x(lenderPrincipalAddress), process.env[`${principal}_LOAN_FUNDS_ADDRESS`])

    // TODO
    // await agenda.schedule('in 2 minutes', 'verify-create-custom-fund', { ethTransactionId: ethTransaction.id, fundId: fund.id })

    await createFund(txParams, fund, done)
  })
}

async function createFund (txParams, fund, done) {
  web3().eth.sendTransaction(txParams)
    .on('transactionHash', (transactionHash) => {
      fund.fundCreateTxHash = transactionHash
      fund.status = 'CREATING'
      fund.save()
      console.log('FUND CREATING')
    })
    .on('confirmation', async (confirmationNumber, receipt) => {
      const { principal, collateral } = fund
      const { loanMarket } = await getMarketModels(principal, collateral)
      const { minConf } = loanMarket

      if (confirmationNumber === minConf) {
        const fundCreateLog = receipt.logs.filter(log => log.topics[0] === ensure0x(keccak256('Create(bytes32)').toString('hex')))

        if (fundCreateLog.length > 0) {
          const { data: fundId } = fundCreateLog[0]

          fund.fundId = hexToNumber(fundId)
          fund.status = 'CREATED'
          fund.save()
          console.log('FUND CREATED')
        } else {
          console.error('Error: Fund Id could not be found in transaction logs')
        }
      }
    })
    .on('error', (error) => {
      console.log(error)
      done()
    })
}

module.exports = {
  defineFundsJobs
}
