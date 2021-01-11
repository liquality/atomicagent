module.exports = (status = 401) => (req, res, next) => {
  const { session } = req

  if (!session.authAt) {
    return res.notOk(status, 'Unauthorised')
  }

  next()
}
