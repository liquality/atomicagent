const _ = require('lodash')
const asyncHandler = require('express-async-handler')
const router = require('express').Router()

const LoanMarket = require('../../models/LoanMarket')

// TODO: fix http error response codes in all routes

router.get('/loanmarketinfo', asyncHandler(async (req, res) => {
  const { query } = req
  const q = _.pick(query, ['collateral', 'principal'])

  const result = await LoanMarket.find(q).exec()

  res.json(result.map(r => r.json()))
}))

module.exports = router


router.get('/agentinfo/:marketId', asyncHandler(async (req, res) => {
  const { params } = req

  const loanMarket = await LoanMarket.findOne({ _id: params.marketId }).exec()

  const agentAddresses = await loanMarket.getAgentAddresses()

  res.json(agentAddresses)
}))

module.exports = router
