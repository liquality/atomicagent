const mongoose = require('mongoose')
const Sentry = require('@sentry/node')
const config = require('./config')

// Enable Sentry (for production only)
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

// Load DB settings
const forceMigrate = config.database.migrate.force
const logMigrate = config.database.migrate.log
const verboseMigrate = config.database.migrate.verbose
if (config.database.debug) {
  mongoose.set('debug', true)
}

// Connect to DB
const mongooseOnError = err => {
  console.error(err)
  process.exit(1)
}

mongoose
  .connect(config.database.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  })
  .catch(mongooseOnError)

mongoose
  .connection.on('error', mongooseOnError)

// Run service
switch (process.env.PROCESS_TYPE) {
  case 'api':
    require('./api').start()
    break

  case 'worker':
    require('./worker').start()
    break

  case 'migrate':
    require('./migrate').run({
      force: forceMigrate,
      log: logMigrate,
      verbose: verboseMigrate
    })
    break

  default:
    throw new Error('Unknown PROCESS_TYPE')
}
