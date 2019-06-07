const asyncHandler = require('express-async-handler')
const uuidv4 = require('uuid/v4')
const router = require('express').Router()
const EventEmitter = require('events')

const client = require('./client')
const parse = require('./parse')
const swap = require('./swap')

const storage = {}
const emitter = new EventEmitter()

emitter.on('swap:new', data => swap(emitter, data))
emitter.on('swap:reciprocated', data => {
  storage[data.id].aFundHash = data.aFundHash
  storage[data.id].status = 'reciprocated'
})
emitter.on('swap:done', data => {
  storage[data.id].bClaimHash = data.bClaimHash
  storage[data.id].status = 'done'
})

router.get('/check', (req, res) => {
  res.json(storage[req.query.id])
})

router.post('/swap', (req, res) => {
  const id = uuidv4()
  const { link } = req.body

  const data = parse(link)

  data.id = id
  data.status = 'pending'

  storage[id] = data
  emitter.emit('swap:new', data)

  res.json({
    success: true,
    data
  })
})

router.get('/addresses', asyncHandler(async (req, res) => {
  const btcAddrs = await client.btc.wallet.getAddresses()
  const ethAddrs = await client.eth.wallet.getAddresses()

  const btcAddr = btcAddrs[0]
  const ethAddr = ethAddrs[0]

  res.json({
    success: true,
    data: {
      btc: btcAddr.toString(),
      eth: ethAddr.toString()
    }
  })
}))

router.get('/offers', asyncHandler(async (req, res) => {
  const btcAddrs = await client.btc.wallet.getAddresses()
  const ethAddrs = await client.eth.wallet.getAddresses()

  const btcAddr = btcAddrs[0].toString()
  const ethAddr = ethAddrs[0].toString()

  res.json({
    success: true,
    data: {
      alias: 'Satoshi',
      address: 'http://localhost:9090',
      offers: [
        {
          rate: 0.01,
          have: {
            currency: 'btc',
            max: 5,
            address: btcAddr
          },
          want: {
            currency: 'eth',
            address: ethAddr
          }
        },
        {
          rate: 105,
          have: {
            currency: 'eth',
            max: 100,
            address: ethAddr
          },
          want: {
            currency: 'btc',
            address: btcAddr
          }
        }
      ]
    }
  })
}))

module.exports = router
