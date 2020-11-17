const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const { fromUnixTime, differenceInDays, parseISO, compareAsc, format, eachDayOfInterval } = require('date-fns')

const Market = require('../../models/Market')
const Order = require('../../models/Order')
const MarketHistory = require('../../models/MarketHistory')

const addressVariants = address => {
  const addressLowerCase = address.toLowerCase()

  const arr = [address, addressLowerCase]

  if (/0x/i.test(address)) {
    arr.push(address.replace(/^0x/, ''), addressLowerCase.replace(/^0x/, ''))
  } else {
    arr.push(`0x${address}`, `0x${addressLowerCase}`)
  }

  return [...new Set(arr)]
}

router.get('/orders', asyncHandler(async (req, res) => {
  const { q, from, to, start, end, status, excludeStatus, userAgent } = req.query
  let { limit, page, sort } = req.query

  try {
    page = parseInt(page)
    if (!page || page < 1) throw new Error('Invalid page')
  } catch (e) {
    page = 1
  }

  try {
    limit = parseInt(limit)
    if (!limit || limit < 1 || limit > 25) throw new Error('Invalid limit')
  } catch (e) {
    limit = 25
  }

  if (!sort) sort = '-createdAt'

  const query = {}

  if (userAgent && userAgent.length !== 2) {
    if (userAgent[0] === 'WALLET') {
      query.userAgent = 'wallet'
    } else {
      query.userAgent = { $exists: false }
    }
  }

  if (q) {
    const inAddresses = { $in: addressVariants(q) }

    query.$or = [
      { orderId: inAddresses },

      { fromCounterPartyAddress: inAddresses },
      { toCounterPartyAddress: inAddresses },
      { fromAddress: inAddresses },
      { toAddress: inAddresses },

      { fromFundHash: inAddresses },
      { fromSecondaryFundHash: inAddresses },
      { fromClaimHash: inAddresses },
      { toFundHash: inAddresses },
      { toSecondaryFundHash: inAddresses },
      { toRefundHash: inAddresses },

      { secretHash: inAddresses }
    ]
  }

  if (from && from.length > 0) {
    query.from = { $in: from }
  }

  if (to && to.length > 0) {
    query.to = { $in: to }
  }

  if (status && status.length > 0) {
    query.status = { $in: status }
  } else if (excludeStatus && excludeStatus.length > 0) {
    query.status = { $nin: excludeStatus }
  }

  if (start) {
    query.createdAt = { $gte: new Date(Number(start)) }
  }

  if (end) {
    if (!query.createdAt) query.createdAt = {}

    query.createdAt.$lte = new Date(Number(end))
  }

  const result = await Order.find(query, null, {
    sort,
    skip: limit * (page - 1),
    limit
  }).exec()

  res.json({
    page,
    count: result.length,
    result
  })
}))

router.get('/rate', asyncHandler(async (req, res) => {
  const { market, timestamp } = req.query

  const rate = await MarketHistory.getRateNear(market, timestamp)

  res.json({
    result: rate
  })
}))

router.get('/statsByAddress', asyncHandler(async (req, res) => {
  const { address } = req.query

  const inAddresses = { $in: addressVariants(address) }

  const _result = await Order.aggregate([
    {
      $match: {
        status: 'AGENT_CLAIMED',
        $or: [
          { fromCounterPartyAddress: inAddresses },
          { toCounterPartyAddress: inAddresses },
          { fromAddress: inAddresses },
          { toAddress: inAddresses }
        ]
      }
    },
    {
      $group: {
        _id: null,
        USD_VOLUME: { $sum: '$fromAmountUsd' },
        COUNT: { $sum: 1 }
      }
    }
  ]).exec()

  const [result] = _result

  res.json({
    address,
    result: {
      usd_volume: ((result || {}).USD_VOLUME) || 0,
      count: ((result || {}).COUNT) || 0
    }
  })
}))

router.get('/topAddresses', asyncHandler(async (req, res) => {
  let { sort, page, limit } = req.query

  try {
    page = parseInt(page)
    if (!page || page < 1) throw new Error('Invalid page')
  } catch (e) {
    page = 1
  }

  try {
    limit = parseInt(limit)
    if (!limit || limit < 1 || limit > 25) throw new Error('Invalid limit')
  } catch (e) {
    limit = 25
  }

  if (!sort) sort = 'volume'

  const sortKey = sort.endsWith('volume')
    ? 'USD_VOLUME'
    : 'COUNT'

  const _result = await Order.aggregate([
    {
      $match: {
        status: 'AGENT_CLAIMED'
      }
    },
    {
      $addFields: {
        market: { $concat: ['$from', '-', '$to'] }
      }
    },
    {
      $group: {
        _id: '$fromAddress',
        USD_VOLUME: { $sum: '$fromAmountUsd' },
        MARKETS: { $addToSet: '$market' },
        COUNT: { $sum: 1 }
      }
    },
    {
      $sort: { [sortKey]: sort.startsWith('-') ? -1 : 1 }
    },
    {
      $skip: limit * (page - 1)
    },
    {
      $limit: limit
    }
  ]).exec()

  const result = _result.map(r => ({
    address: r._id,
    usd_volume: r.USD_VOLUME,
    count: r.COUNT,
    markets: r.MARKETS
  }))

  res.json({
    count: result.length,
    result
  })
}))

router.get('/stats', asyncHandler(async (req, res) => {
  let { start, end, address } = req.query
  start = new Date(Number(start))
  end = new Date(Number(end))

  const markets = (await Market.find({}, 'from to').exec()).map(market => `${market.from}-${market.to}`)

  const $group = markets.reduce((acc, market) => {
    acc[`${market}:USD_VOLUME`] = { $sum: { $cond: [{ $eq: ['$market', market] }, '$fromAmountUsd', 0] } }
    acc[`${market}:COUNT`] = { $sum: { $cond: [{ $eq: ['$market', market] }, 1, 0] } }

    return acc
  }, {})

  const $match = {
    status: 'AGENT_CLAIMED',
    createdAt: {
      $gte: start,
      $lte: end
    }
  }

  if (address) {
    const inAddresses = { $in: addressVariants(address) }

    $match.$or = [
      { fromCounterPartyAddress: inAddresses },
      { toCounterPartyAddress: inAddresses },
      { fromAddress: inAddresses },
      { toAddress: inAddresses }
    ]
  }

  const result = await Order.aggregate([
    {
      $match
    },
    {
      $addFields: {
        market: { $concat: ['$from', '-', '$to'] },
        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
      }
    },
    {
      $group: {
        _id: '$date',
        ...$group,
        'WALLET:USD_VOLUME': { $sum: { $cond: [{ $eq: ['$userAgent', 'wallet'] }, '$fromAmountUsd', 0] } },
        'WALLET:COUNT': { $sum: { $cond: [{ $eq: ['$userAgent', 'wallet'] }, 1, 0] } },
        USD_VOLUME: { $sum: '$fromAmountUsd' },
        COUNT: { $sum: 1 }
      }
    }
  ]).exec()

  const stats = result.map(json => {
    const date = json._id
    delete json._id

    const volume = json.USD_VOLUME
    delete json.USD_VOLUME

    const count = json.COUNT
    delete json.COUNT

    return {
      date,
      count,
      usd_volume: volume,
      wallet_count: json['WALLET:COUNT'],
      wallet_volume: json['WALLET:USD_VOLUME'],
      markets: Object.entries(json).reduce((acc, [key, value]) => {
        const [market, type] = key.split(':')
        if (market === 'WALLET') return acc

        if (!acc[market]) acc[market] = {}
        acc[market][type.toLowerCase()] = value

        return acc
      }, {})
    }
  })

  eachDayOfInterval({
    start: start,
    end: end
  }).forEach(date => {
    date = format(date, 'yyyy-MM-dd')
    if (stats.find(stat => stat.date === date)) return

    stats.push({
      date,
      count: 0,
      usd_volume: 0,
      markets: markets.reduce((acc, market) => {
        acc[market] = {
          count: 0,
          usd_volume: 0
        }

        return acc
      }, {})
    })
  })

  stats.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))

  res.json({
    count: result.length,
    result: {
      markets,
      stats
    }
  })
}))

router.get('/rates', asyncHandler(async (req, res) => {
  const { market, start, end } = req.query

  if (!market) return res.notOk(400, 'Value not specified: market')
  if (!start) return res.notOk(400, 'Value not specified: start')
  if (!end) return res.notOk(400, 'Value not specified: end')
  if (start >= end) return res.notOk(400, 'Invalid values: start should be <= end')

  const diff = differenceInDays(fromUnixTime(end), fromUnixTime(start))
  if (diff > 30) return res.notOk(400, 'Range cannot exceed 30 days')

  const result = await MarketHistory.getRates(market, start, end)

  res.json({
    count: result.length,
    result
  })
}))

router.get('/accumulate', asyncHandler(async (req, res) => {
  const [result] = await Order.aggregate([
    {
      $match: {
        status: 'AGENT_CLAIMED'
      }
    },
    {
      $group: {
        _id: null,
        USD_VOLUME: { $sum: '$fromAmountUsd' },
        COUNT: { $sum: 1 }
      }
    }
  ]).exec()

  res.json({
    result: {
      usd_volume: result.USD_VOLUME,
      count: result.COUNT
    }
  })
}))

module.exports = router
