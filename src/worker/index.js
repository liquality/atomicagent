const debug = require('debug')('liquality:agent:worker')
const fs = require('fs').promises
const path = require('path')
const Queue = require('bull')
const Redis = require('ioredis')
const { assets } = require('@liquality/cryptoassets')
const { v4: uuidv4 } = require('uuid')

const config = require('../config')
const reportError = require('../utils/reportError')

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
          client = new Redis(config.redis.uri, redisOpts)
        }
        return client
      case 'subscriber':
        if (!subscriber) {
          subscriber = new Redis(config.redis.uri, redisOpts)
        }
        return subscriber
      case 'bclient': {
        const client = new Redis(config.redis.uri, redisOpts)
        bclients.push(client)
        return client
      }
      default:
        throw new Error(`Unexpected connection type: "${type}"`)
    }
  }
}

const addUniqueJob = (q, name, data = {}, opts = {}) => {
  if (name === 'UpdateMarketData') {
    return q.add(
      {
        groupBy: 'market-data'
      },
      {
        removeOnComplete: true,
        jobId: 'update-market-data-job'
      }
    )
  }

  const defaultOpts = {}

  if (name === 'verify-tx') {
    defaultOpts.delay = 1000 * 20

    if (!data.groupBy) {
      data.groupBy = uuidv4()
    }
  } else if (data.orderId) {
    defaultOpts.jobId = `${name}:${data.orderId}`
  }

  if (data.asset) {
    data.groupBy = assets[data.asset].chain
  } else if (!data.groupBy) {
    data.groupBy = 'other-jobs'
  }

  const arr = []
  if (name && name !== '__default__') {
    arr.push(name)
  }

  arr.push(data, { ...defaultOpts, ...opts })

  debug('addUniqueJob', ...arr)

  return mainqueue.add(...arr)
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
    q.on('completed', async (_, result) => {
      if (!result?.next) return

      result.next.forEach((newJob) => {
        const { name, data = {}, opts = {} } = newJob
        addUniqueJob(q, name, data, opts)
      })
    })

    q.on('failed', async (job, err) => {
      if (q.name === 'UpdateMarketData' || err.name === 'RescheduleError') {
        const args = [
          job.name,
          job.data,
          {
            delay: err.delay || job.opts.delay
          }
        ]

        await job.remove()

        debug(`[Failed] Adding "${job.name}" due to ${err.name} (${err.message})`, args)

        addUniqueJob(q, ...args)
      } else {
        reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })
      }
    })

    q.on('error', (err) => {
      reportError(err, { queueName: q.name })
    })

    q.on('stalled', (job) => {
      const err = new Error('Job has stalled')
      reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })
    })
  })

  // kickoff market data update
  addUniqueJob(updateMarketDataQueue, 'UpdateMarketData')
}

module.exports.stop = async () => {
  if (stopping) return
  stopping = true

  await Promise.all(queueArr.map((q) => q.close()))
  await Promise.all([client, subscriber, ...bclients].map((c) => c.disconnect()))

  console.log('Closed worker')
}

module.exports.getQueues = () => [mainqueue, updateMarketDataQueue]
module.exports.getAtomicAgentQueue = () => mainqueue
module.exports.getMarketDataQueue = () => updateMarketDataQueue
