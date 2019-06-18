const asyncHandler = require('express-async-handler')
const uuidv4 = require('uuid/v4')
const router = require('express').Router()
const EventEmitter = require('events')

const parse = require('../utils/parse')
const init = require('../utils/init')
const swap = require('../utils/swap')

const storage = {}
const emitter = new EventEmitter()

emitter.on('init:new', (client, data) => init(emitter, client, data))
emitter.on('init:link', data => {
  storage[data.id] = data.link
})
emitter.on('init:done', data => {
  storage[data.id].bClaimHash = data.bClaimHash
  storage[data.id].status = 'done'
})

emitter.on('swap:new', (client, data) => swap(emitter, client, data))
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

router.post('/init', asyncHandler(async (req, res) => {
  const client = req.app.get('client')
  const id = uuidv4()
  const {
    ccy1,
    ccy1Addr,

    ccy2,
    ccy2Addr
  } = req.body

  const ccy1CounterPartyAddr = await client[ccy1].wallet.getAddresses()
  const ccy2CounterPartyAddr = await client[ccy2].wallet.getAddresses()

  const data = {
    id,

    ccy1,
    ccy1Addr,
    ccy1CounterPartyAddr: ccy1CounterPartyAddr[0].address,

    ccy2,
    ccy2Addr,
    ccy2CounterPartyAddr: ccy2CounterPartyAddr[0].address,

    status: 'pending'
  }

  emitter.emit('init:new', client, data)

  let int = setInterval((r, i) => {
    if (storage[id]) {
      clearInterval(int)

      r.json({
        success: true,
        data: storage[i]
      })
    }
  }, 500, res, id)
}))

router.post('/swap', (req, res) => {
  const client = req.app.get('client')
  const id = uuidv4()
  const { link } = req.body

  const data = parse(link)

  data.id = id
  data.status = 'pending'

  storage[id] = data
  emitter.emit('swap:new', client, data)

  res.json({
    success: true,
    data
  })
})

router.get('/addresses', asyncHandler(async (req, res) => {
  const client = req.app.get('client')
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
  const client = req.app.get('client')
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
