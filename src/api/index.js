const Sentry = require('@sentry/node')

const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const cors = require('cors')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const basicAuth = require('express-basic-auth')
const { createBullBoard } = require('@bull-board/api')
const { BullAdapter } = require('@bull-board/api/bullAdapter')
const { ExpressAdapter } = require('@bull-board/express')

const { getQueues } = require('../syncMarketData')
const config = require('../config')
const httpHelpers = require('../middlewares/httpHelpers')
const handleHttpError = require('../middlewares/handleHttpError')

let listen

const sessionConfig = {
  name: 'liquality',
  secret: config.auth.cookieSecret,
  store: MongoStore.create({ mongoUrl: config.database.uri }),
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  cookie: {
    path: '/',
    httpOnly: true,
    secure: false,
    maxAge: config.auth.cookieMaxAgeMs
  }
}

module.exports.start = () => {
  const app = express()

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
    app.use(Sentry.Handlers.requestHandler())
    sessionConfig.cookie.secure = true
  }

  app.use(session(sessionConfig))
  app.use(httpHelpers())
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  )
  app.use(cors())
  app.use(compression())
  app.use(bodyParser.json({ limit: '5mb' }))
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }))
  app.set('etag', false)

  app.use('/api/user', require('./routes/user'))
  app.use('/api/swap', require('./routes/swap'))
  app.use('/api/dash', require('./routes/dash'))

  const queues = getQueues()
  const roServerAdapter = new ExpressAdapter()
  const rwServerAdapter = new ExpressAdapter()

  createBullBoard({
    queues: queues.map((q) => new BullAdapter(q, { readOnlyMode: true })),
    serverAdapter: roServerAdapter
  })

  createBullBoard({
    queues: queues.map((q) => new BullAdapter(q)),
    serverAdapter: rwServerAdapter
  })

  roServerAdapter.setBasePath('/queues')
  rwServerAdapter.setBasePath('/admin/queues')

  app.use(
    '/queues',
    basicAuth({
      users: { admin: config.application.queuePassword },
      challenge: true,
      realm: 'AtomicAgentRO'
    }),
    roServerAdapter.getRouter()
  )

  app.use(
    '/admin/queues',
    basicAuth({
      users: { admin: config.application.queuePasswordRW },
      challenge: true,
      realm: 'AtomicAgentRW'
    }),
    rwServerAdapter.getRouter()
  )

  if (process.env.NODE_ENV === 'production') {
    app.use(Sentry.Handlers.errorHandler())
  }

  app.use(handleHttpError())

  listen = app.listen(process.env.PORT || config.application.apiPort)

  return listen
}

module.exports.app = () => {
  if (!listen) throw new Error("API server isn't running")

  return listen
}

module.exports.stop = async () => {
  if (!listen) throw new Error("API server isn't running")

  return new Promise((resolve) => {
    listen.close(() => {
      console.log('Closed http server')
      resolve()
    })
  })
}
