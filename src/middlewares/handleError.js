const httpError = require('../utils/httpError')

module.exports = () => (err, req, res, next) => {
  const status = err.statusCode || 500
  const message = err.message || err.toString()

  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  }

  return httpError(req, res, status, message)
}
