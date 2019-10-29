const Sentry = require('@sentry/node')

const express = require('express')
const helmet = require('helmet')
const compression = require('compression')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const Agenda = require('agenda')
const config = require('../config')
// const Agendash = require('agendash')

const cors = require('../middlewares/cors')
const httpHelpers = require('../middlewares/httpHelpers')
const handleError = require('../middlewares/handleError')

const agenda = new Agenda({ mongo: mongoose.connection })
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
// app.use('/queue', Agendash(agenda))

if (process.env.NODE_ENV === 'production') {
  app.use(Sentry.Handlers.errorHandler())
}

app.use(handleError())

app.listen(config.apiPort)
