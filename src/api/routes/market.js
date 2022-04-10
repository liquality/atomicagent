const asyncHandler = require('express-async-handler')
const router = require('express').Router()

const Market = require('../../models/Market')

router.get(
  '/market',
  asyncHandler(async (req, res) => {
    await Market.updateAllMarketData()

    res.json({
      message: 'Market data updated'
    })
  })
)

module.exports = router
