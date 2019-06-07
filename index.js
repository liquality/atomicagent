if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const path = require('path')
const express = require('express')
const helmet = require('helmet')
const compress = require('compression')
const bodyParser = require('body-parser')
const proxy = require('http-proxy-middleware')

const cors = require('./cors')

const app = express()

app.set('etag', false)
app.use(helmet())
app.use(compress())
app.use(cors())
app.use(bodyParser.json({ limit: '5mb' }))
app.use('/api', require('./api'))

if (process.env.NODE_ENV === 'production') {
  app.use('/', express.static(path.join(__dirname, 'ui', 'dist')))
  app.use('/*', express.static(path.join(__dirname, 'ui', 'dist', 'index.html')))
} else {
  app.use('/', proxy({
    target: 'http://localhost:8080/',
    changeOrigin: true
  }))
}

app.listen(process.env.PORT)
