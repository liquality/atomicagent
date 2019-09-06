const _ = require('lodash')
const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const { checksumEncode } = require('@liquality/ethereum-utils')
const BN = require('bignumber.js')
const { verifySignature } = require('../../utils/signatures')
const clients = require('../../utils/clients')
const { currencies } = require('../../utils/fx')

const LoanMarket = require('../../models/LoanMarket')

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

  const toAmount = BN(amount).times(currencies[currency].baseUnit).toFixed()

  const withdrawHash = await clients[currency].chain.sendTransaction(address, toAmount)

  res.json({ withdrawHash })
}))

module.exports = router
