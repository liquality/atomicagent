const _ = require('lodash')
const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const { checksumEncode } = require('@liquality/ethereum-utils')
const BN = require('bignumber.js')
const { verifySignature } = require('../../utils/signatures')
const clients = require('../../utils/clients')
const { currencies } = require('../../utils/fx')
const { loadObject } = require('../../utils/contracts')
const { rateToSec } = require('../../utils/finance')
const web3 = require('../../utils/web3')
const { toWei, hexToNumber } = web3.utils

const LoanMarket = require('../../models/LoanMarket')
const Fund = require('../../models/Fund')

// TODO: fix http error response codes in all routes

router.get('/loanmarketinfo', asyncHandler(async (req, res) => {
  const { query } = req
  const q = _.pick(query, ['collateral', 'principal'])

  const result = await LoanMarket.find(q).exec()

  res.json(result.map(r => r.json()))
}))

router.get('/agentinfo/:marketId', asyncHandler(async (req, res) => {
  const { params } = req

  const loanMarket = await LoanMarket.findOne({ _id: params.marketId }).exec()

  const agentAddresses = await loanMarket.getAgentAddresses()

  res.json(agentAddresses)
}))

router.post('/withdraw', asyncHandler(async (req, res, next) => {
  const currentTime = Math.floor(new Date().getTime() / 1000)
  const address = checksumEncode(process.env.ETH_SIGNER)

  const { body } = req
  const { signature, message, amount, timestamp, currency } = body

  if (!verifySignature(signature, message, address)) return next(res.createError(401, 'Signature doesn\'t match address'))
  if (!(message === `Withdraw ${amount} ${currency} to ${address} at ${timestamp}`)) return next(res.createError(401, 'Message doesn\'t match params'))
  if (!(currentTime <= (timestamp + 60))) return next(res.createError(401, 'Signature is stale'))

  const toAmount = BN(amount).times(currencies[currency].multiplier).toFixed()

  const withdrawHash = await clients[currency].chain.sendTransaction(address, toAmount)

  res.json({ withdrawHash })
}))

router.post('/funds/new', asyncHandler(async (req, res, next) => {
  let fund
  const { body } = req
  const { principal, collateral, custom, maxLoanDuration, maxFundDuration, compoundEnabled, amount } = body
  const funds = await loadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`])

  const loanMarket = await LoanMarket.findOne(_.pick(body, ['principal', 'collateral'])).exec()
  if (!loanMarket) return next(res.createError(401, `LoanMarket not found with ${principal} principal and ${collateral} collateral`))

  const { principalAddress } = await loanMarket.getAgentAddresses()

  if (custom) {
    const { liquidationRatio, interest, penalty, fee } = body
    const { minPrincipal, maxPrincipal, minLoanDuration } = loanMarket

    const fundParams = [
      toWei(minPrincipal.toString(), currencies[principal].unit),
      toWei(maxPrincipal.toString(), currencies[principal].unit),
      minLoanDuration,
      maxLoanDuration,
      maxFundDuration,
      toWei((liquidationRatio / 100).toString(), 'gether'), // 150% collateralization ratio
      toWei(rateToSec(interest.toString()), 'gether'), // 16.50%
      toWei(rateToSec(penalty.toString()), 'gether'), //  3.00%
      toWei(rateToSec(fee.toString()), 'gether'), //  0.75%
      process.env.ETH_ARBITER,
      compoundEnabled,
      amount
    ]

    const fundId = await funds.methods.createCustom(...fundParams).call()

    const { transactionHash } = await funds.methods.createCustom(...fundParams).send({ from: principalAddress, gas: 6000000 })

    fund = Fund.fromCustomFundParams(fundParams, hexToNumber(fundId), transactionHash)
    await fund.save()
  } else {
    const fundParams = [
      maxLoanDuration,
      maxFundDuration,
      process.env.ETH_ARBITER,
      compoundEnabled,
      amount
    ]

    const fundId = await funds.methods.create(...fundParams).call()

    const { transactionHash } = await funds.methods.create(...fundParams).send({ from: principalAddress, gas: 6000000 })

    fund = Fund.fromFundParams(fundParams, hexToNumber(fundId), transactionHash)
    await fund.save()
  }

  res.json(fund.json())
}))

module.exports = router
