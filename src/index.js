const Sentry = require('@sentry/node')

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

const mongoose = require('mongoose')
const config = require('./config')

if (config.database.debug) {
  mongoose.set('debug', true)
}

const mongooseOnError = err => {
  console.error(err)
  process.exit(1)
}

mongoose
  .connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })
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
