const { spawn } = require('child_process')
const _ = require('lodash')

const config = require('../config')
const Order = require('../models/Order')
//TODO update the agenda to queue
module.exports = (queue) =>
  ['start', 'success', 'fail'].forEach((event) => {
    queue.on(event, async (...args) => {
      const error = JSON.stringify(event.startsWith('fail') ? args[0] : null)
      const job = event.startsWith('fail') ? args[1] : args[0]
      const attrs = JSON.stringify(job.attrs)
      const order = await Order.findOne({ orderId: _.get(job, 'attrs.data.orderId') }).exec()
      const orderJson = JSON.stringify(order)

      spawn(config.worker.jobReporter, [event, error, attrs, orderJson], { stdio: 'inherit' })
    })
  })
