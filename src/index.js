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
const dbConfig = config.database || {}
if (process.env.MONGO_URI) dbConfig.uri = process.env.MONGO_URI // override with env var
const migrateOpts = dbConfig.migrate || {}
mongoConnect.connect(dbConfig)

// Run service
switch (process.env.PROCESS_TYPE) {
  case 'api':
    require('./api').start()
    break

  case 'worker':
    require('./worker').start()
    break

  case 'migrate':
    require('./migrate').run(migrateOpts)
    break

  default:
    runApiService()
}

async function runApiService () {
  await require('./migrate').run(migrateOpts)
  require('./api').start()
}
