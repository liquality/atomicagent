// eslint-disable-next-line no-unused-vars
module.exports = () => (err, req, res, next) => {
  const status = err.statusCode || 500
  const message = err.message || err.toString()

  console.error(err)

  return res.notOk(status, message)
}
