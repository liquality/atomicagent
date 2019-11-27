const Sentry = require('@sentry/node')

const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const Agenda = require('agenda')

const config = require('../config')

const cors = require('../middlewares/cors')
const httpHelpers = require('../middlewares/httpHelpers')
const handleError = require('../middlewares/handleError')

const agenda = new Agenda().database(config.database.uri, null, { useNewUrlParser: true })
const app = express()

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

module.exports = app.listen(config.application.apiPort)
