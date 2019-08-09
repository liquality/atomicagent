const createError = require('http-errors')

module.exports = (req, res, status, message) => {
  const err = createError(status, message)
  const id = res.sentry
  message = err.message

  res.status(status)

  if (req.acceptJson) {
    const obj = {
      error: message
    }

    if (id) obj.id = id

    return res.json(obj)
  } else {
    message = [message]

    if (id) message.push(`(Event ID: ${id})`)

    message = message.join(' ')

    return res.send(message)
  }
}
