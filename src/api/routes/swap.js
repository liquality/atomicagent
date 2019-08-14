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

  const { amount } = body
  if (!(market.min <= amount &&
      amount <= market.max)) {
    return next(res.createError(401, 'Invalid amount'))
  }

  const order = Order.fromMarket(market, body.amount)

  await order.setAgentAddresses()
  await order.save()

  res.json(order.json())
}))

router.post('/order/:orderId', asyncHandler(async (req, res, next) => {
  const agenda = req.app.get('agenda')
  const { params, body } = req

  const order = await Order.findOne({ _id: params.orderId }).exec()
  if (!order) return next(res.createError(401, 'Order not found'))

  ;['fromAddress', 'toAddress', 'fromFundHash', 'secretHash', 'swapExpiration'].forEach(key => {
    if (!body[key]) return next(res.createError(401, `${key} is missing`))
    order[key] = body[key]
  })

  order.status = 'QUOTE'
  await order.save()
  await agenda.now('verify-user-init-tx', { orderId: order.id })

  res.json(order.json())
}))

router.get('/order/:orderId', asyncHandler(async (req, res, next) => {
  const { params } = req

  const order = await Order.findOne({ _id: params.orderId }).exec()
  if (!order) return next(res.createError(401, 'Order not found'))

  res.json(order.json())
}))

module.exports = router
