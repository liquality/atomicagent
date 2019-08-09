const cors = require('cors')

module.exports = () => cors((req, callback) => {
  const corsOptions = {
    origin: true,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Content-Length', 'Accept-Encoding', 'X-CSRF-Token'],
    credentials: true
  }

  callback(null, corsOptions)
})
