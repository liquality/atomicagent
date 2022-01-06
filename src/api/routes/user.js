const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const { spawn } = require('child_process')
const { parseArgsStringToArgv } = require('string-argv')

const config = require('../../config')
const Check = require('../../models/Check')
const Order = require('../../models/Order')

const ensureAuth = require('../../middlewares/ensureAuth')

const ALLOWED_TYPES = ['reciprocate-init-swap']

const ALLOWED_ACTIONS = ['approve', 'reject']

const ALLOWED_RETRY_JOBS = [
  {
    name: 'reciprocate-init-swap',
    setStatus: 'USER_FUNDED'
  },
  {
    name: 'fund-swap',
    setStatus: 'AGENT_CONTRACT_CREATED'
  },
  {
    name: 'find-claim-tx-or-refund',
    setStatus: 'AGENT_FUNDED'
  },
  {
    name: 'agent-claim',
    setStatus: 'USER_CLAIMED'
  }
]

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { body } = req

    if (body.password !== config.auth.simplePassword) {
      return res.notOk(401, 'Invalid password')
    }

    req.session.authAt = Date.now()

    res.ok()
  })
)

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await new Promise((resolve) => {
      if (req.session) {
        req.session.destroy(() => {
          resolve()
        })
      } else {
        resolve()
      }
    })

    res.ok()
  })
)

router.post(
  '/killswitch',
  ensureAuth(401),
  asyncHandler(async (req, res) => {
    const arr = parseArgsStringToArgv(config.worker.killswitch)
    spawn(arr.shift(), arr, { stdio: 'inherit' }) // TODO: find a better way
    res.ok()
  })
)

router.get(
  '/',
  ensureAuth(200),
  asyncHandler(async (req, res) => {
    res.ok()
  })
)

router.get(
  '/order',
  ensureAuth(401),
  asyncHandler(async (req, res) => {
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
  })
)

router.post(
  '/order/retry',
  ensureAuth(401),
  asyncHandler(async (req, res) => {
    const agenda = req.app.get('agenda')
    const { body } = req
    const { orderId, jobName } = body

    if (!orderId) {
      return res.notOk(400, 'Order ID missing')
    }

    if (!ALLOWED_RETRY_JOBS.find((job) => job.name === jobName)) {
      return res.notOk(400, `Invalid job name: ${jobName}`)
    }

    const order = await Order.findOne({ orderId: orderId }).exec()
    if (!order) {
      return res.notOk(400, `Order not found: ${orderId}`)
    }

    const index = ALLOWED_RETRY_JOBS.findIndex((job) => job.name === jobName)
    const jobsToBeRemoved = ALLOWED_RETRY_JOBS.slice(index).map((job) => job.name)

    await agenda.cancel({
      name: {
        $in: jobsToBeRemoved
      },
      'data.orderId': orderId
    })

    order.status = ALLOWED_RETRY_JOBS[index].setStatus
    await order.save()

    await agenda.now(jobName, { orderId: order.orderId })

    await order.log('RETRY', jobName)

    res.ok()
  })
)

router.post(
  '/order/ignore',
  ensureAuth(401),
  asyncHandler(async (req, res) => {
    const { body } = req
    const { orderId, setQuoteExpired } = body

    if (!orderId) {
      return res.notOk(400, 'Order ID missing')
    }

    const order = await Order.findOne({ orderId: orderId }).exec()
    if (!order) {
      return res.notOk(400, `Order not found: ${orderId}`)
    }

    Object.entries(order.txMap).forEach(([key, value]) => {
      if (!value.blockHash) {
        order.set(`txMap.${key}.replacedBy`, true)
      }
    })

    if (setQuoteExpired) {
      order.status = 'QUOTE_EXPIRED'
    }

    await order.save()

    await order.log('IGNORE')

    res.ok()
  })
)

router.post(
  '/order',
  ensureAuth(401),
  asyncHandler(async (req, res) => {
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
  })
)

module.exports = router
