const _ = require('lodash')
const asyncHandler = require('express-async-handler')
const router = require('express').Router()

const Market = require('../../models/Market')
const Order = require('../../models/Order')

// TODO: fix http error response codes in all routes

router.get('/marketinfo', asyncHandler(async (req, res) => {
  const { query } = req
  const q = _.pick(query, ['from', 'to'])

  const result = await Market.find(q).exec()

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
  const passphrase = body.passphrase || req.get('X-Liquality-Agent-Passphrase')

  if (passphrase) {
    order.setPassphrase(passphrase)
  }

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

  ;['fromAddress', 'toAddress', 'fromFundHash', 'secretHash', 'swapExpiration'].forEach(key => {
    if (!body[key]) return next(res.createError(401, `${key} is missing`))
    order[key] = body[key]
  })

  order.status = 'QUOTE'
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

  res.json(order.json())
}))

module.exports = router
