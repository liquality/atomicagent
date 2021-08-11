const Sentry = require('@sentry/node')

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

const mongoose = require('mongoose')
const config = require('./config')

console.log('[DEVING] process.env.TEST_ME:', process.env.TEST_ME)
console.log('[DEVING] process.env.NODE_ENV:', process.env.NODE_ENV)
console.log('[DEVING] process.env.PROCESS_TYPE:', process.env.PROCESS_TYPE)
console.log('[DEVING] process.env.CONFIG_PATH:', process.env.CONFIG_PATH)
console.log('[DEVING] config:', config)

if (config.database.debug) {
  mongoose.set('debug', true)
}

const mongooseOnError = err => {
  console.error(err)
  process.exit(1)
}

mongoose
  .connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })
  .catch(mongooseOnError)

mongoose
  .connection.on('error', mongooseOnError)

switch (process.env.PROCESS_TYPE) {
  case 'api':
    require('./api').start()
    break

  case 'worker':
    require('./worker').start()
    break

  case 'migrate':
    require('./migrate').run()
    break

  default:
    throw new Error('Unknown PROCESS_TYPE')
}
