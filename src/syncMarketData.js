const Sentry = require('@sentry/node')

// Enable Sentry (for production only)
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

const mongo = require('./utils/mongo')
const Market = require('./models/Market')
const cron = require('node-cron')

const syncMarketData = async () => {
  await Market.updateAllMarketData()
}
const task = cron.schedule('* * * * *', () => {
  syncMarketData()
})

mongo.connect()

async function start() {
  console.log('worker', JSON.stringify(syncMarketData))
  await task.start()
}

function stop(signal) {
  return async function () {
    console.log('Received', signal)

    await task.stop()
    await mongo.disconnect()
    process.exit(0)
  }
}

switch (process.env.PROCESS_TYPE) {
  case 'migrate':
    require('./migrate').run()
    break

  default: {
    start()

    process.on('SIGTERM', stop('SIGTERM'))
    process.on('SIGINT', stop('SIGINT'))

    break
  }
}
