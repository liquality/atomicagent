const debug = require('debug')('liquality:agent:worker')
const path = require('path')
const Queue = require('bull')
const Redis = require('ioredis')

const config = require('../config')
const reportError = require('../utils/reportError')

let client
let subscriber
let stopping = false

const bclients = []

let atomicAgentQueue
let verifyTxQueue
let updateMarketDataQueue
const queueArr = []
const QUEUES_DIR = path.join(__dirname, 'queues')

const checkJobForRetry = (err, job) => {
  // retrying the timeout jobs only for the below specific jobs
  if (!err || !err.message || !job) return false

  if (
    err.message.includes('timeout of 30000ms exceeded') ||
    err.message.includes('Request failed with status code 400') ||
    err.message.includes('Request failed with status code 502') ||
    err.message.includes('connection timed out')
  ) {
    return true
  }

  return false
}

const opts = {
  redis: { maxRetriesPerRequest: null, enableReadyCheck: false },
  settings: {
    lockDuration: 30000,
    lockRenewTime: 30000,
    stalledInterval: 30000,
    maxStalledCount: 1
  },
  defaultJobOptions: {
    stackTraceLimit: 5
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

module.exports.start = async () => {
  if (atomicAgentQueue) throw new Error('Worker is already running')

  atomicAgentQueue = new Queue('AtomicAgent', opts)
  atomicAgentQueue.process(1, path.join(QUEUES_DIR, 'atomicagent.js'))

  updateMarketDataQueue = new Queue('UpdateMarketData', {
    ...opts,
    limiter: {
      max: 1,
      duration: 1000 * 5,
      bounceBack: true
    }
  })
  updateMarketDataQueue.process(1, path.join(QUEUES_DIR, 'update-market-data.js'))

  verifyTxQueue = new Queue('VerifyTx', opts)
  verifyTxQueue.process(1, path.join(QUEUES_DIR, 'verify-tx.js'))

  queueArr.push(atomicAgentQueue, verifyTxQueue, updateMarketDataQueue)

  queueArr.forEach((q) => {
    q.on('completed', async (job, result) => {
      if (!result) return

      //We don't need as we are enabling the flag removeOnComplete
      //await job.remove()

      if (result.updateMarketData) {
        debug('Adding updateMarketData job in complete')
        await updateMarketDataQueue.add(
          {},
          {
            delay: 1000 * 15,
            removeOnComplete: true,
            jobId: 'update-market-data-job'
          }
        )
      }

      if (result.atomicAgent) {
        await atomicAgentQueue.add(result.atomicAgent, {
          delay: 1000 * 10,
          jobId: result.atomicAgent.orderId
        })
      }

      if (result.verify) {
        await verifyTxQueue.add(result.verify, {
          delay: 1000 * 15,
          removeOnComplete: true,
          jobId: `${result.verify.orderId}:${result.verify.type}`
        })
      }
    })

    q.on('failed', async (job, err) => {
      reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })

      if (['UpdateMarketData', 'VerifyTx'].includes(q.name) || checkJobForRetry(err, job)) {
        debug('Retrying', job)

        await job.remove()

        await q.add(job.data, {
          delay: opts.delay || 1000 * 10,
          removeOnComplete: opts.removeOnComplete,
          jobId: opts.jobId
        })

        return
      }
    })

    q.on('error', (err) => {
      reportError(err, { queueName: q.name })
    })

    q.on('stalled', async (job) => {
      const err = new Error('Job has stalled')
      reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })
    })
  })

  return updateMarketDataQueue.add(
    {},
    {
      removeOnComplete: true,
      jobId: 'update-market-data-job'
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

module.exports.getQueues = () => [atomicAgentQueue, verifyTxQueue, updateMarketDataQueue]
module.exports.getAtomicAgentQueue = () => atomicAgentQueue
