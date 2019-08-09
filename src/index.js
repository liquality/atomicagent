const {
  NODE_ENV,
  PROCESS_TYPE,
  SENTRY_DSN,
  LIQUALITY_ENV
} = process.env

const fs = require('fs')
const path = require('path')
const Sentry = require('@sentry/node')

if (NODE_ENV === 'production') {
  let COMMIT_HASH = null

  try {
    COMMIT_HASH = fs.readFileSync(path.join(__dirname, '..', 'COMMIT_HASH'), 'utf8').trim()
  } catch (e) {}

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: LIQUALITY_ENV,
    release: COMMIT_HASH
  })
} else {
  require('dotenv').config()
}

console.log(`Booting ${PROCESS_TYPE}`)

const mongoose = require('mongoose')
const MONGO_REQUIRED_FOR = ['api', 'worker', 'migrate']

if (MONGO_REQUIRED_FOR.includes(PROCESS_TYPE)) {
  console.log('Connecting to mongodb')
  mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useCreateIndex: true })

  // if (NODE_ENV !== 'production') {
  //   mongoose.set('debug', true)
  // }
}

switch (PROCESS_TYPE) {
  case 'api':
    require('./api')
    break

  case 'worker':
    require('./worker')
    break

  case 'migrate':
    require('./migrate')
    break

  default:
    throw new Error('Unknown PROCESS_TYPE')
}
