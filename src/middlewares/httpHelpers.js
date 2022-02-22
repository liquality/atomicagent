const debug = require('debug')('liquality:agent:http-helpers')
const _ = require('lodash')

module.exports = () =>
  function (req, res, next) {
    if (req.xhr || _.get(req, 'headers.accept', '').includes('json') || process.env.NODE_ENV === 'test') {
      req.acceptJson = true
    }

    res.ok = function (data = 'OK') {
      if (req.acceptJson) {
        return res.json({
          success: true,
          data
        })
      } else {
        return res.send(data)
      }
    }

    res.notOk = function (status, message) {
      debug('res.notOk', status, message)

      res.status(status)

      const id = res.sentry

      if (req.acceptJson) {
        const data = { error: message }

        if (id) data.id = id

        return res.json(data)
      } else {
        let data = message

        if (id) data = `${data} (Event ID: ${id})`

        return res.send(data)
      }
    }

    next()
  }
