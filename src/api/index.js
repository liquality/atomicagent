const Sentry = require('@sentry/node')

const mongoose = require('mongoose')
const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const Agenda = require('agenda')
const cors = require('cors')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)

const config = require('../config')
const httpHelpers = require('../middlewares/httpHelpers')
const handleHttpError = require('../middlewares/handleHttpError')

let listen

const sessionConfig = {
  name: 'liquality',
  secret: config.auth.cookieSecret,
  store: new MongoStore({ mongooseConnection: mongoose.connection }),
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
  const agenda = new Agenda().database(config.database.uri, null, { useNewUrlParser: true })

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
    app.use(Sentry.Handlers.requestHandler())
    sessionConfig.cookie.secure = true
  }

  app.use(session(sessionConfig))
  app.use(httpHelpers())
  app.use(helmet({
    contentSecurityPolicy: false
  }))
  app.use(cors())
  app.use(compression())
  app.use(bodyParser.json({ limit: '5mb' }))
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }))
  app.set('etag', false)
  app.set('agenda', agenda)

  app.use('/api/user', require('./routes/user'))
  app.use('/api/swap', require('./routes/swap'))
  app.use('/api/dash', require('./routes/dash'))

  // TODO: guard this route
  if (process.env.NODE_ENV !== 'test') {
    app.use('/queue', require('agendash')(agenda, {
      title: 'Agent Queues'
    }))
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(Sentry.Handlers.errorHandler())
  }

  app.use(handleHttpError())

  listen = app.listen(config.application.apiPort || process.env.PORT)

  return listen
}

module.exports.app = () => {
  if (!listen) throw new Error('API server isn\'t running')

  return listen
}
