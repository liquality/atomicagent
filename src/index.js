const Sentry = require('@sentry/node')

// Enable Sentry (for production only)
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

const mongoConnect = require('./utils/mongoConnect')
const config = require('./config')

// Load db settings and establish connection
mongoConnect.connect(config.database)

// Run service
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
