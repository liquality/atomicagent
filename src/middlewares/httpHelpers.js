const _ = require('lodash')
const createError = require('http-errors')

const httpOk = require('../utils/httpOk')

module.exports = () => function (req, res, next) {
  if (req.xhr || _.get(req, 'headers.accept', '').includes('json')) {
    req.acceptJson = true
  }

  res.ok = function (data) {
    return httpOk(req, res, data)
  }

  res.createError = createError

  next()
}
