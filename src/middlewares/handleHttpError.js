module.exports = () => (err, req, res) => {
  const status = err.statusCode || 500
  const message = err.message || err.toString()

  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  }

  return res.notOk(status, message)
}
