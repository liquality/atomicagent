module.exports = (req, res, data = 'OK') => {
  if (req.acceptJson) {
    return res.json({
      success: true,
      data
    })
  } else {
    return res.send(data)
  }
}
