const express = require('express')
const helmet = require('helmet')
const compress = require('compression')
const uuidv4 = require('uuid/v4')
const { Client, providers } = require('@liquality/bundle')
const EventEmitter = require('events')

const cors = require('./cors')
const node = new EventEmitter()

const app = express()
const nodeEth = new Client()
nodeEth.addProvider(new providers.ethereum.EthereumRpcProvider('http://localhost:8545/'))
nodeEth.addProvider(new providers.ethereum.EthereumSwapProvider())

const nodeBtc = new Client()
nodeBtc.addProvider(new providers.bitcoin.BitcoinBitcoreRpcProvider('http://localhost:4321/bitcoind/', 'bitcoin', 'local321'))
nodeBtc.addProvider(new providers.bitcoin.BitcoinBitcoinJsLibSwapProvider({ network: providers.bitcoin.networks['bitcoin_testnet'] }))

app.use(helmet())
app.use(compress())
app.use(cors())
app.set('etag', false)

const register = {}

app.get('/check/:id', (req, res) => {
  res.json(register[req.params.id])
})

const NODE_BTC_ADDR = ''
const NODE_ETH_ADDR = ''

node.on('new:swap', async (id, ethtx, value, ethaddr, btcaddr, secrethash, expiration) => {
  await nodeEth.swap.verifyInitiateSwapTransaction(ethtx, value, NODE_ETH_ADDR, ethaddr, secrethash, expiration)
  console.log('Found & verified ETH tx')
  const btcval = 100000
  const initSwapBtc = await nodeBtc.swap.initiateSwap(btcval, btcaddr, NODE_BTC_ADDR, secrethash, expiration)
  console.log('Params', btcval, btcaddr, NODE_BTC_ADDR, secrethash, expiration)
  console.log('initSwapBtc', initSwapBtc)

  register[id].tx = initSwapBtc
  register[id].value = btcval

  nodeBtc.swap.findClaimSwapTransaction(initSwapBtc, btcaddr, NODE_BTC_ADDR, secrethash, expiration).then(async function (tx) {
    console.log('Node found user\'s claim tx', tx.secret)
    console.log(await nodeEth.swap.claimSwap(ethtx, NODE_ETH_ADDR, ethaddr, tx.secret, expiration))
    register[id].done = true
    console.log('Node has claimed!')
  })
})

app.post('/init/:ethtx/:value/:ethaddr/:btcaddr/:secrethash/:expiration', (req, res) => {
  const id = uuidv4()
  const {
    ethtx,
    value,
    ethaddr,
    btcaddr,
    secrethash,
    expiration
  } = req.params

  node.emit('new:swap', id, ethtx, value, ethaddr, btcaddr, secrethash, expiration)

  register[id] = {
    status: 'pending',
    tx: null
  }

  res.json({
    id
  })
})

app.get('/offers.json', (req, res) => {
  res.json({
    alias: 'Satoshi',
    address: 'http://localhost:9090',
    offers: [
      {
        rate: 0.01,
        have: {
          currency: 'btc',
          max: 5,
          address: NODE_BTC_ADDR
        },
        want: {
          currency: 'eth',
          address: NODE_ETH_ADDR
        }
      },
      {
        rate: 105,
        have: {
          currency: 'eth',
          max: 100,
          address: NODE_ETH_ADDR
        },
        want: {
          currency: 'btc',
          address: NODE_BTC_ADDR
        }
      }
    ]
  })
})

app.listen(process.env.PORT || 9090)
