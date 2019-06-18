const path = require('path')
const express = require('express')
const helmet = require('helmet')
const compress = require('compression')
const bodyParser = require('body-parser')
const proxy = require('http-proxy-middleware')

const Client = require('./agent/utils/client')
const cors = require('./agent/middlewares/cors')

module.exports = options => {
  const app = express()

  app.set('client', Client(options))
  app.set('etag', false)
  app.use(helmet())
  app.use(compress())
  app.use(cors())
  app.use(bodyParser.json({ limit: '5mb' }))
  app.use('/api', require('./agent/routes/api'))

  if (process.env.UI_DEV === 'true') {
    app.use('/', proxy({
      target: 'http://localhost:8081/',
      changeOrigin: true
    }))
  } else {
    app.use('/', express.static(path.join(__dirname, 'dist')))
    app.use('/*', express.static(path.join(__dirname, 'dist', 'index.html')))
  }

  app.listen(options.port)

  console.log(`Atomic Agent with UI is running on ${options.port}`)
}
