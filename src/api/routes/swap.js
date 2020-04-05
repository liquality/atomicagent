const _ = require('lodash')
const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const BigNumber = require('bignumber.js')

const Asset = require('../../models/Asset')
const Market = require('../../models/Market')
const Order = require('../../models/Order')

const jobs = require('../../utils/jobs')
const fx = require('../../utils/fx')

const pkg = require('../../../package.json')

// TODO: fix http error response codes in all routes

router.get('/assetinfo', asyncHandler(async (req, res) => {
  const { query } = req
  const q = _.pick(query, ['code'])

  const result = await Asset.find(q).exec()

  res.json(result.map(r => r.json()))
}))

router.get('/marketinfo', asyncHandler(async (req, res) => {
  const { query } = req
  const q = _.pick(query, ['from', 'to'])
  const queryAssets = Object.values(q).filter(v => !!v)
  const marketQuery = {}

  if (queryAssets.length > 0) {
    marketQuery.$or = [
      { from: { $in: queryAssets } },
      { to: { $in: queryAssets } }
    ]
  }

  let markets = await Market.find(marketQuery).exec()
  const requestedAssets = [...markets.reduce((acc, market) => {
    acc.add(market.to)
    acc.add(market.from)

    return acc
  }, new Set())]
  const assets = await Asset.find({ code: { $in: requestedAssets } }).exec()

  markets = markets.map(market => {
    const { from, to, max } = market
    const { rate } = markets.find(market => market.to === from && market.from === to) || {
      rate: BigNumber(1).div(market.rate)
    }

    const fromAsset = assets.find(asset => asset.code === from)
    const toAsset = assets.find(asset => asset.code === to)

    market.max = BigNumber.min(
      fx.calculateToAmount(to, from, toAsset.max, rate),
      fromAsset.max,
      max
    ).toNumber()

    return market
  })

  if (q.from && q.to) {
    markets = markets.filter(market => market.to === q.to && market.from === q.from)
  } else if (q.from) {
    markets = markets.filter(market => market.from === q.from)
  } else if (q.to) {
    markets = markets.filter(market => market.to === q.to)
  }

  res.json(markets.map(market => market.json()))
}))

router.get('/orders', asyncHandler(async (req, res) => {
  const result = await Order.find({}, { secret: 0 }).exec()

  res.json(result.map(r => r.json()))
}))

router.post('/order', asyncHandler(async (req, res, next) => {
  const { body } = req

  const market = await Market.findOne(_.pick(body, ['from', 'to'])).exec()
  if (!market) return next(res.createError(401, 'Market not found'))

  const { fromAmount } = body
  if (!(market.min <= fromAmount &&
    fromAmount <= market.max)) {
    return next(res.createError(401, 'Invalid amount'))
  }

  const order = Order.fromMarket(market, body.fromAmount)

  const addresses = await order.toClient().wallet.getUsedAddresses()
  const balance = await order.toClient().chain.getBalance(addresses)

  if (BigNumber(balance).isLessThan(BigNumber(order.toAmount))) {
    return next(res.createError(401, 'Insufficient balance'))
  }

  const passphrase = body.passphrase || req.get('X-Liquality-Agent-Passphrase')

  if (passphrase) {
    order.setPassphrase(passphrase)
  }

  order.setExpiration()

  await order.setAgentAddresses()
  await order.save()

  res.json(order.json())
}))

router.post('/order/:orderId', asyncHandler(async (req, res, next) => {
  const agenda = req.app.get('agenda')
  const { params, body } = req

  const order = await Order.findOne({ orderId: params.orderId }).exec()
  if (!order) return next(res.createError(401, 'Order not found'))

  if (order.passphraseHash) {
    const passphrase = body.passphrase || req.get('X-Liquality-Agent-Passphrase')

    if (!passphrase) return next(res.createError(401, 'You are not authorised'))
    if (!order.verifyPassphrase(passphrase)) return next(res.createError(401, 'You are not authorised'))
  }

  if (order.status !== 'QUOTE') return next(res.createError(401, 'Order was already updated'))

  const fromFundHashExists = await Order.findOne({ fromFundHash: body.fromFundHash }).exec()
  if (fromFundHashExists) return next(res.createError(401, 'Duplicate fromFundHash'))

  const keysToBeCopied = ['fromAddress', 'toAddress', 'fromFundHash', 'secretHash']

  for (let i = 0; i < keysToBeCopied.length; i++) {
    const key = keysToBeCopied[i]

    if (!body[key]) return next(res.createError(401, `${key} is missing`))

    order[key] = body[key]
  }

  order.status = 'USER_FUNDED_UNVERIFIED'

  await order.save()
  await agenda.now('verify-user-init-tx', { orderId: order.orderId })

  res.json(order.json())
}))

router.get('/order/:orderId', asyncHandler(async (req, res, next) => {
  const { params, query } = req

  const order = await Order.findOne({ orderId: params.orderId }).exec()
  if (!order) return next(res.createError(401, 'Order not found'))

  if (order.passphraseHash) {
    const passphrase = query.passphrase || req.get('X-Liquality-Agent-Passphrase')

    if (!passphrase) return next(res.createError(401, 'You are not authorised'))
    if (!order.verifyPassphrase(passphrase)) return next(res.createError(401, 'You are not authorised'))
  }

  const json = order.json()

  if (query.verbose === 'true') {
    try {
      json.agent_version = pkg.version
      json.job_data = await jobs.find(params.orderId)
    } catch (e) {
      json.verbose_error = e.toString()
    }
  }

  res.json(json)
}))

module.exports = router
