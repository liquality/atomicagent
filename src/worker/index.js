const debug = require('debug')('liquality:agent:worker')
const _ = require('lodash')
const fs = require('fs').promises
const path = require('path')
const Queue = require('bull')
const Redis = require('ioredis')
const { assets } = require('@liquality/cryptoassets')

const reportError = require('./reportError')

const { REDIS_URL } = process.env

let client
let subscriber
let stopping = false

const bclients = []

let mainqueue
let updateMarketDataQueue
const queueArr = []
const QUEUES_DIR = path.join(__dirname, 'queues')

const opts = {
  limiter: {
    max: 1,
    duration: 1000 * 15,
    groupKey: 'groupBy'
  },
  redis: { maxRetriesPerRequest: null, enableReadyCheck: false },
  settings: {
    lockDuration: 45000,
    lockRenewTime: 22500,
    stalledInterval: 45000
  },
  createClient: function (type, redisOpts) {
    switch (type) {
      case 'client':
        if (!client) {
          client = new Redis(REDIS_URL, redisOpts)
        }
        return client
      case 'subscriber':
        if (!subscriber) {
          subscriber = new Redis(REDIS_URL, redisOpts)
        }
        return subscriber
      case 'bclient': {
        const client = new Redis(REDIS_URL, redisOpts)
        bclients.push(client)
        return client
      }
      default:
        throw new Error(`Unexpected connection type: "${type}"`)
    }
  }
}

const addUniqueJob = (name, data = {}, opts = {}) => {
  const defaultOpts = {
    removeOnComplete: true
  }

  if (name === 'verify-tx') {
    defaultOpts.delay = 1000 * 20
  } else if (data.orderId) {
    defaultOpts.jobId = `${name}:${data.orderId}`
  }

  if (data.asset) {
    data.groupBy = assets[data.asset].chain
  } else {
    data.groupBy = Date.now() + '-' + Math.random()
  }

  const newOpts = { ...defaultOpts, ...opts }

  mainqueue.add(name, data, newOpts)
}

module.exports.addUniqueJob = addUniqueJob

module.exports.start = async () => {
  if (mainqueue) throw new Error('Worker is already running')

  const queues = (await fs.readdir(QUEUES_DIR)).filter((name) => name.endsWith('.js'))
  mainqueue = new Queue('AtomicAgent', opts)

  queues.forEach((queueFileName) => {
    const processorName = path.basename(queueFileName, '.js')
    const processorPath = path.join(QUEUES_DIR, queueFileName)

    if (queueFileName.startsWith('update-market-data')) {
      updateMarketDataQueue = new Queue('UpdateMarketData', opts)
      updateMarketDataQueue.process(1, processorPath)
    } else {
      mainqueue.process(processorName, 1, processorPath)
    }
  })

  queueArr.push(mainqueue, updateMarketDataQueue)

  queueArr.forEach((q) => {
    if (q.name !== 'UpdateMarketData') {
      q.on('completed', async (_, result) => {
        if (!result?.next) return

        result.next.forEach((newJob) => {
          const { name, data = {}, opts = {} } = newJob
          addUniqueJob(name, data, opts)
        })
      })
    }

    q.on('failed', async (job, err) => {
      if (err.name === 'RescheduleError') {
        await job.remove()

        const opts = _.pick(job.opts, ['removeOnComplete', 'jobId'])
        opts.delay = err.delay || job.opts.delay

        debug(`Adding ${job.name} due to RescheduleError with ${opts.delay}ms delay`)

        const data = {
          chain: assets[err.asset].chain,
          ...job.data
        }

        q.add(job.name, data, opts)
      } else {
        reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })
      }
    })

    q.on('error', (err) => {
      debug(err)
      reportError(err, { queueName: q.name })
    })

    q.on('stalled', (job) => {
      debug('Job has stalled', job)
      const err = new Error('Job has stalled')
      reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })
    })
  })

  // kickoff market data update
  updateMarketDataQueue.add(
    {},
    {
      jobId: 'update-market-data-job',
      repeat: {
        every: 1000 * 30
      }
    }
  )
}

module.exports.stop = async () => {
  if (stopping) return
  stopping = true

  await Promise.all(queueArr.map((q) => q.close()))
  await Promise.all([client, subscriber, ...bclients].map((c) => c.disconnect()))

  console.log('Closed worker')
}

module.exports.queue = mainqueue
