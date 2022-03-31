const asyncHandler = require('express-async-handler')
const router = require('express').Router()
const { fromUnixTime, differenceInDays, parseISO, compareAsc, eachDayOfInterval, format } = require('date-fns')
const debug = require('debug')('liquality:agent:dash')
const Market = require('../../models/Market')
const Order = require('../../models/Order')
const MarketHistory = require('../../models/MarketHistory')

const mergeJSON = (data) => {
  const result = {}

  data.forEach((dataSet) => {
    for (let [key, value] of Object.entries(dataSet)) {
      if (key === '_id' || key === 'wallet:count' || key === 'count') {
        result[key] = value
        continue
      }
      if (result[key]) {
        result[key] += value
      } else {
        result[key] = value
      }
    }
  })
  return result
}

const addressHashVariants = (address) => {
  const addressLowerCase = address.toLowerCase()

  const arr = [address, addressLowerCase]

  if (/0x/i.test(address)) {
    arr.push(...arr.map((item) => item.replace(/^0x/, '')))
  } else {
    arr.push(...arr.map((item) => `0x${item}`))
  }

  return [...new Set(arr)]
}

const getLimitPageSort = ({ limit, page, sort }, defaultSortBy = '-createdAt') => {
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

  if (!sort) sort = defaultSortBy

  return {
    limit,
    page,
    sort
  }
}

const createQuery = (_query) => {
  const { q, from, to, start, end, status, excludeStatus, userAgent, pending } = _query
  const query = {}

  if (userAgent && userAgent.length !== 2) {
    if (userAgent[0] === 'WALLET') {
      query.userAgent = {
        $regex: /^Wallet/i
      }
    } else {
      query.userAgent = {
        $regex: /^SwapUI/i
      }
    }
  }

  if (q) {
    const inAddresses = { $in: addressHashVariants(q) }

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

  if (pending) {
    query.hasAgentUnconfirmedTx = true
  }

  return query
}

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const query = createQuery(req.query)
    const { limit, page, sort } = getLimitPageSort(req.query)

    const result = await Order.find(query, null, {
      sort,
      skip: limit * (page - 1),
      limit
    })
      .lean()
      .exec()

    res.json({
      page,
      count: result.length,
      result
    })
  })
)

router.get(
  '/rate',
  asyncHandler(async (req, res) => {
    const { market, timestamp } = req.query

    const rate = await MarketHistory.getRateNear(market, timestamp)

    res.json({
      result: rate
    })
  })
)

router.get(
  '/statsByAddress',
  asyncHandler(async (req, res) => {
    const { address } = req.query

    const inAddresses = { $in: addressHashVariants(address) }

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
          'sum:fromAmountUsd': { $sum: '$fromAmountUsd' },
          'sum:toAmountUsd': { $sum: '$toAmountUsd' },
          count: { $sum: 1 }
        }
      }
    ]).exec()

    const result = _result[0] || {}

    res.json({
      address,
      result
    })
  })
)

router.get(
  '/topAddresses',
  asyncHandler(async (req, res) => {
    const { limit, page, sort } = getLimitPageSort(req.query, 'volume')

    const sortKey = sort.endsWith('volume') ? 'sum:fromAmountUsd' : 'count'

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
          'sum:fromAmountUsd': { $sum: '$fromAmountUsd' },
          'sum:toAmountUsd': { $sum: '$toAmountUsd' },
          markets: { $addToSet: '$market' },
          count: { $sum: 1 }
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

    const result = _result.map((r) => {
      r.address = r._id
      delete r._id

      return r
    })

    res.json({
      count: result.length,
      result
    })
  })
)

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const query = createQuery({
      ...req.query,
      status: ['AGENT_CLAIMED']
    })
    let allMarkets = (await Market.find({}, 'from to').lean().exec()).map((market) => `${market.from}-${market.to}`)

    const groupSize = 10
    let result = []
    const marketGroups = allMarkets
      .map((e, i) => {
        return i % groupSize === 0 ? allMarkets.slice(i, i + groupSize) : null
      })
      .filter((e) => {
        return e
      })

    marketGroups.forEach(async (markets) => {
      const $group = markets.reduce((acc, market) => {
        acc[`market:${market}:sum:fromAmountUsd`] = {
          $sum: { $cond: [{ $eq: ['$market', market] }, '$fromAmountUsd', 0] }
        }
        acc[`market:${market}:sum:toAmountUsd`] = {
          $sum: { $cond: [{ $eq: ['$market', market] }, '$toAmountUsd', 0] }
        }
        acc[`market:${market}:count`] = {
          $sum: { $cond: [{ $eq: ['$market', market] }, 1, 0] }
        }

        return acc
      }, {})

      const marketResult = await Order.aggregate([
        {
          $match: query
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
            'wallet:sum:fromAmountUsd': {
              $sum: {
                $cond: [{ $or: { input: '$userAgent', regex: /^Wallet/i } }, '$fromAmountUsd', 0]
              }
            },
            'wallet:sum:toAmountUsd': {
              $sum: {
                $cond: [{ $or: { input: '$userAgent', regex: /^Wallet/i } }, '$toAmountUsd', 0]
              }
            },
            'wallet:count': {
              $sum: {
                $cond: [{ $or: { input: '$userAgent', regex: /^Wallet/i } }, 1, 0]
              }
            },
            'sum:totalAgentFeeUsd': { $sum: '$totalAgentFeeUsd' },
            'sum:totalUserFeeUsd': { $sum: '$totalUserFeeUsd' },
            'sum:fromAmountUsd': { $sum: '$fromAmountUsd' },
            'sum:toAmountUsd': { $sum: '$toAmountUsd' },
            count: { $sum: 1 }
          }
        }
      ]).exec()

      debug('market result =>', marketResult)
      result.push(marketResult)
    })

    //flatten and group by date
    result = result.flat(1).reduce((r, ele) => {
      r[ele._id] = r[ele._id] || []
      r[ele._id].push(ele)
      return r
    }, Object.create(null))

    //merge all with sum
    let finalResults = []
    Object.keys(result).forEach((key) => {
      finalResults.push(mergeJSON(result[key]))
    })

    result = finalResults

    const stats = result.map((json) => {
      json.date = json._id
      delete json._id

      json.markets = Object.entries(json)
        .filter(([key]) => key.startsWith('market:'))
        .reduce((acc, [key, value]) => {
          const arr = key.split(':')
          arr.shift() // discard 'market'

          const market = arr.shift()
          const type = arr.join(':')

          if (!acc[market]) acc[market] = {}
          acc[market][type] = value

          return acc
        }, {})

      return json
    })
    debug('result=>', stats)
    const emptyDataPoint = {
      'wallet:sum:fromAmountUsd': 0,
      'wallet:sum:toAmountUsd': 0,
      'wallet:count': 0,
      'sum:totalAgentFeeUsd': 0,
      'sum:totalUserFeeUsd': 0,
      'sum:fromAmountUsd': 0,
      'sum:toAmountUsd': 0,
      count: 0
    }

    eachDayOfInterval({
      start: new Date(Number(req.query.start)),
      end: new Date(Number(req.query.end))
    }).forEach((date) => {
      date = format(date, 'yyyy-MM-dd')
      if (stats.find((stat) => stat.date === date)) return

      stats.push({
        date,
        ...emptyDataPoint
      })
    })

    stats.sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)))

    res.json({
      count: result.length,
      result: {
        allMarkets,
        stats
      }
    })
  })
)

router.get(
  '/rates',
  asyncHandler(async (req, res) => {
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
  })
)

router.get(
  '/accumulate',
  asyncHandler(async (req, res) => {
    const [result] = await Order.aggregate([
      {
        $match: {
          status: 'AGENT_CLAIMED'
        }
      },
      {
        $group: {
          _id: null,
          'sum:fromAmountUsd': { $sum: '$fromAmountUsd' },
          'sum:toAmountUsd': { $sum: '$toAmountUsd' },
          count: { $sum: 1 }
        }
      }
    ]).exec()

    res.json({
      result
    })
  })
)

module.exports = router
