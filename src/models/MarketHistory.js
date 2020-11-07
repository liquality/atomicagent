const mongoose = require('mongoose')
const { formatISO, getUnixTime } = require('date-fns')

const MarketHistorySchema = new mongoose.Schema({
  market: {
    type: String,
    index: true
  },
  count: {
    type: Number,
    index: true
  },
  first: {
    type: Number,
    index: true
  },
  last: {
    type: Number,
    index: true
  },
  day: {
    type: Date,
    index: true
  },
  rates: {
    type: Array
  }
}, { strict: false })

MarketHistorySchema.static('logRate', async function (market, rate, time) {
  if (!time) time = Date.now()

  const day = formatISO(time, { representation: 'date' })
  time = getUnixTime(time)

  return MarketHistory.updateOne(
    {
      market,
      count: { $lt: 120 },
      day
    },
    {
      $push: { rates: { r: rate, t: time } },
      $min: { first: time },
      $max: { last: time },
      $inc: { count: 1 }
    },
    {
      upsert: true
    }
  )
})

MarketHistorySchema.static('getRates', async function (market, start, end) {
  return MarketHistory.aggregate([
    { $match: { market, first: { $gte: Number(start) }, last: { $lte: Number(end) } } },
    { $unwind: '$rates' },
    { $group: { _id: '$day', rates: { $push: '$rates' } } },
    { $unwind: '$rates' },
    { $project: { _id: 0, r: '$rates.r', t: '$rates.t' } }
  ])
})

MarketHistorySchema.static('getMostRecentRate', async function (market) {
  const timestamp = Math.ceil(Date.now() / 1000)

  const { rates } = await MarketHistory.findOne({
    market,
    last: { $lte: timestamp },
    'rates.t': { $lte: timestamp }
  }).sort('-last').limit(1).exec()

  return rates[rates.length - 1].r
})

const MarketHistory = mongoose.model('MarketHistory', MarketHistorySchema)
module.exports = MarketHistory
