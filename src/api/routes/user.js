const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const { spawn } = require('child_process')

const config = require('../../config')
const Check = require('../../models/Check')
const Order = require('../../models/Order')

const ensureAuth = require('../../middlewares/ensureAuth')

const ALLOWED_TYPES = [
  'reciprocate-init-swap'
]

const ALLOWED_ACTIONS = [
  'approve',
  'reject'
]

router.post('/login', asyncHandler(async (req, res) => {
  const { body } = req

  if (body.password !== config.auth.simplePassword) {
    return res.notOk(401, 'Invalid password')
  }

  req.session.authAt = Date.now()

  res.ok()
}))

router.post('/logout', asyncHandler(async (req, res) => {
  await new Promise(resolve => {
    if (req.session) {
      req.session.destroy(_ => {
        resolve()
      })
    } else {
      resolve()
    }
  })

  res.ok()
}))

router.post('/killswitch', ensureAuth(401), asyncHandler(async (req, res) => {
  spawn(config.worker.killswitch, [], { stdio: 'inherit' }) // TODO: find a better way
  res.ok()
}))

router.get('/', ensureAuth(200), asyncHandler(async (req, res) => {
  res.ok()
}))

router.get('/order', ensureAuth(401), asyncHandler(async (req, res) => {
  const { query } = req
  const { orderId } = query

  if (!orderId) {
    return res.notOk(400, 'Order ID missing')
  }

  const order = await Order.findOne({ orderId: orderId }).exec()
  if (!order) {
    return res.notOk(400, `Order not found: ${orderId}`)
  }

  const check = await Check.findOne({ orderId: orderId }).exec()
  res.ok(check)
}))

router.post('/order', ensureAuth(401), asyncHandler(async (req, res) => {
  const { body } = req
  const { orderId, type, message, action } = body

  if (!orderId) {
    return res.notOk(400, 'Order ID missing')
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return res.notOk(400, `Invalid type: ${type}`)
  }

  if (!ALLOWED_ACTIONS.includes(action)) {
    return res.notOk(400, `Invalid action: ${action}`)
  }

  const order = await Order.findOne({ orderId: orderId }).exec()
  if (!order) {
    return res.notOk(400, `Order not found: ${orderId}`)
  }

  const check = await Check.getCheckForOrder(orderId)

  const entry = check.get(`flags.${type}`) || {}
  if (entry.reject) {
    return res.notOk(400, `Check ${orderId}:${type} has already been rejected: ${entry.message}`)
  }

  if (entry.approve) {
    return res.notOk(400, `Check ${orderId}:${type} has already been approved: ${entry.message}`)
  }

  check.set(`flags.${type}`, {
    [action]: new Date(),
    message
  })

  await check.save()

  await order.log('AUTH', action === 'approve' ? 'APPROVED' : 'REJECTED', { type, message, action })

  res.ok()
}))

module.exports = router
