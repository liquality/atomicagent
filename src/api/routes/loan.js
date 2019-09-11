const _ = require('lodash')
const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const { ensure0x, checksumEncode } = require('@liquality/ethereum-utils')
const BN = require('bignumber.js')
const { verifySignature } = require('../../utils/signatures')
const clients = require('../../utils/clients')
const { currencies } = require('../../utils/fx')
const { loadObject } = require('../../utils/contracts')
const { rateToSec, numToBytes32 } = require('../../utils/finance')
const web3 = require('../../utils/web3')
const { toWei, fromWei, hexToNumber, hexToAscii } = web3.utils

const LoanMarket = require('../../models/LoanMarket')
const Market = require('../../models/Market')
const Fund = require('../../models/Fund')
const LoanRequest = require('../../models/LoanRequest')

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

    const fundStruct = await funds.methods.funds(fundId).call()
    console.log('Fund Created: ', fundStruct)

    fund = Fund.fromCustomFundParams(fundParams, hexToNumber(fundId), transactionHash, principal, collateral)
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

router.post('/requests', asyncHandler(async (req, res, next) => {
  const { body } = req
  const { principal, collateral, principalAmount, loanDuration } = body

  const loanMarket = await LoanMarket.findOne({ principal, collateral }).exec()
  if (!loanMarket) return next(res.createError(401, 'Loan Market not found'))

  const market = await Market.findOne({ from: collateral, to: principal }).exec()
  if (!market) return next(res.createError(401, 'Market not found'))

  const fund = await Fund.findOne({ principal, collateral }).exec()
  if (!fund) return next(res.createError(401, 'Fund not found'))

  const { rate } = market
  const { fundId } = fund

  const funds = await loadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`])

  const liquidationRatio = await funds.methods.liquidationRatio(numToBytes32(fundId)).call()

  const minimumCollateralAmount = BN(principalAmount).dividedBy(rate).times(fromWei(liquidationRatio, 'gether')).toFixed(8)

  const loanRequest = LoanRequest.fromLoanMarket(loanMarket, body, minimumCollateralAmount)

  await loanRequest.setAgentAddresses()
  await loanRequest.save()

  res.json(loanRequest.json())
}))

router.post('/requests/:requestId', asyncHandler(async (req, res, next) => {
  const currentTime = Date.now()
  const agenda = req.app.get('agenda')
  const { params, body } = req
  const { proofOfFundsTxHex, borrowerSecretHashes, borrowerCollateralPublicKey, borrowerPrincipalAddress } = body

  const loanMarket = await LoanMarket.findOne(_.pick(body, ['principal', 'collateral'])).exec()
  if (!loanMarket) return next(res.createError(401, 'Loan Market not found'))

  const loanRequest = await LoanRequest.findOne({ _id: params.requestId }).exec()
  if (!loanRequest) return next(res.createError(401, 'Loan Request not found'))
  const {
    principal, collateral, principalAmount, minimumCollateralAmount, requestLoanDuration, requestExpiresAt, requestCreatedAt, lenderPrincipalAddress, lenderCollateralPublicKey
  } = loanRequest

  const market = await Market.findOne({ from: collateral, to: principal }).exec()
  if (!market) return next(res.createError(401, 'Market not found'))
  const { rate } = market

  ;['borrowerSecretHashes', 'borrowerCollateralPublicKey', 'borrowerPrincipalAddress'].forEach(key => {
    if (!body[key]) return next(res.createError(401, `${key} is missing`))
    loanRequest[key] = body[key]
  })

  const proofOfFundsTxValid = (await clients[collateral].getMethod('jsonrpc')('testmempoolaccept', [proofOfFundsTxHex]))[0].allowed
  if (!proofOfFundsTxValid) return next(res.createError(401, 'Proof of funds tx not valid'))

  const rawTx = await clients[collateral].getMethod('jsonrpc')('decoderawtransaction', proofOfFundsTxHex)

  const { value: collateralAmount } = rawTx.vout[0]
  if (!(collateralAmount >= minimumCollateralAmount)) return next(res.createError(401, `Proof of funds for ${minimumCollateralAmount} ${collateral} not provided`))

  const [ op, msgHex ] = rawTx.vout[1].scriptPubKey.asm.split(' ')
  const msg = hexToAscii(ensure0x(msgHex))

  const [ publicKey, amount, stablecoin, timestamp ] = msg.split(' ')

  if (!(publicKey === lenderCollateralPublicKey)) return next(res.createError(401, 'Proof of funds public key does not match lender public key'))
  if (!(parseFloat(amount) === principalAmount)) return next(res.createError(401, 'Amount provided in signature does not match proof of funds'))
  if (!(principal === stablecoin)) return next(res.createError(401, 'Principal currency does not match principal currency in proof of funds'))
  if (!(requestExpiresAt >= timestamp && timestamp >= requestCreatedAt)) return next(res.createError(401, 'Proof of funds tx incorrect timestamp'))
  if (!(requestExpiresAt >= currentTime && currentTime >= requestCreatedAt)) return next(res.createError(401, 'Request details provided too late. Please request again'))

  loanRequest.status = 'QUOTE'

  await loanRequest.setSecretHashes(collateralAmount)

  const funds = await loadObject('funds', process.env[`${principal}_LOAN_FUNDS_ADDRESS`])

  const fundId = await funds.methods.fundOwner(ensure0x(lenderPrincipalAddress)).call()

  console.log('fundId', fundId)

  const fund = await funds.methods.funds(fundId).call()

  const { lenderSecretHashes } = loanRequest

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

  console.log('test1')

  const loanId = await funds.methods.request(...loanParams).call({ from: ensure0x(lenderPrincipalAddress) })

  const { transactionHash } = await funds.methods.request(...loanParams).send({ from: ensure0x(lenderPrincipalAddress), gas: 6000000 })

  console.log('test2')

  const loans = await loadObject('loans', process.env[`${principal}_LOAN_LOANS_ADDRESS`])

  const owedForLoanInWei = await loans.methods.owedForLoan(loanId).call()
  const owedForLoan = fromWei(owedForLoanInWei, currencies[principal].unit)

  const seizableCollateral = BN(owedForLoan).dividedBy(rate)
  const refundableCollateral = BN(collateralAmount).minus(seizableCollateral)
  
  loanRequest.refundableCollateralAmount = refundableCollateral.toFixed(currencies[collateral].decimals)
  loanRequest.seizableCollateralAmount = seizableCollateral.toFixed(currencies[collateral].decimals)
  loanRequest.loanRequestTxHash = transactionHash
  loanRequest.loanId = hexToNumber(loanId)
  
  await loanRequest.save()

  res.json(loanRequest.json())
}))

module.exports = router
