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

const task = cron.schedule('* * * * *', async () => {
  await Market.updateAllMarketData()
})

mongo.connect()

async function start() {
  console.log('starting sync market data cron')
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
