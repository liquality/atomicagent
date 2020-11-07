const Sentry = require('@sentry/node')

const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const Agenda = require('agenda')
const cors = require('cors')

const config = require('../config')
const httpHelpers = require('../middlewares/httpHelpers')
const handleError = require('../middlewares/handleError')

let listen

module.exports.start = () => {
  const app = express()
  const agenda = new Agenda().database(config.database.uri, null, { useNewUrlParser: true })

  if (process.env.NODE_ENV === 'production') {
    app.use(Sentry.Handlers.requestHandler())
  }

  app.use(httpHelpers())
  app.use(helmet())
  app.use(cors())
  app.use(compression())
  app.use(bodyParser.json({ limit: '5mb' }))
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }))
  app.set('etag', false)
  app.set('agenda', agenda)

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

  app.use(handleError())

  listen = app.listen(config.application.apiPort)

  return listen
}

module.exports.app = () => {
  if (!listen) throw new Error('API server isn\'t running')

  return listen
}
