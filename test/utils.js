/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
chai.should()
chai.use(chaiHttp)

const mongoose = require('mongoose')
const { sha256 } = require('@liquality/crypto')

const config = require('../src/config')
const Asset = require('../src/models/Asset')
const Market = require('../src/models/Market')
const Order = require('../src/models/Order')
const assets = require('../src/migrate/data/assets.json')
const markets = require('../src/migrate/data/markets.json')
const { getClient } = require('../src/utils/clients')

const { app } = require('../src/api')

const sleep = duration => new Promise((resolve, reject) => {
  setTimeout(resolve, duration)
})

const clear = () => Order.deleteMany({})
  .then(() => Asset.deleteMany({}))
  .then(() => Asset.insertMany(assets, { ordered: false }))
  .then(() => Market.deleteMany({}))
  .then(() => Market.insertMany(markets, { ordered: false }))
  .then(() => mongoose.connection.db.collection('agendaJobs').deleteMany({}))

module.exports.prepare = () => mongoose
  .connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })
  .then(() => clear())
  .then(() => require('../src/api').start())
  .then(() => require('../src/worker').start())
  .then(() => sleep(5000))

module.exports.clear = clear

module.exports.sleep = sleep

module.exports.mongoose = mongoose

module.exports.swap = (from, to, fromAmount, refund, lateClaim) => {
  let quote
  let fromBlock

  let toClient
  let toAddress
  let toInitSwapTxHash

  let fromClient
  let fromAddress
  let fromFundHash

  let secret
  let secretHash
  let swapExpiration
  let nodeSwapExpiration

  describe('Quote', () => {
    it('should refuse quote with invalid amount', async () => {
      return chai.request(app())
        .post('/api/swap/order')
        .send({
          from,
          to,
          fromAmount: 10000
        })
        .then(res => {
          res.should.have.status(401)
        })
    })

    it('should accept a quote', async function () {
      this.timeout(15 * 1000)

      return chai.request(app())
        .post('/api/swap/order')
        .send({
          from,
          to,
          fromAmount
        })
        .then(res => {
          res.should.have.status(200)
          res.body.should.be.a('object')

          res.body.from.should.equal(from)
          res.body.to.should.equal(to)

          res.body.swapExpiration.should.be.a('number')
          res.body.nodeSwapExpiration.should.be.a('number')

          res.body.status.should.equal('QUOTE')

          quote = res.body
        })
    })

    it('should get quote by id', async () => {
      return chai.request(app())
        .get(`/api/swap/order/${quote.orderId}`)
        .then(res => {
          res.should.have.status(200)
          res.body.should.be.a('object')

          res.body.orderId.should.equal(quote.orderId)

          res.body.from.should.equal(from)
          res.body.to.should.equal(to)

          res.body.fromAmount.should.equal(fromAmount)

          res.body.swapExpiration.should.equal(quote.swapExpiration)
          res.body.nodeSwapExpiration.should.equal(quote.nodeSwapExpiration)

          res.body.status.should.equal('QUOTE')
        })
    })

    it('should throw an error when quote id is incorrect', async () => {
      return chai.request(app())
        .get('/api/swap/order/abc')
        .then(res => {
          res.should.have.status(401)
        })
    })
  })

  describe('Swap', () => {
    before(async () => {
      fromClient = getClient(quote.from)
      toClient = getClient(quote.to)

      fromAddress = (await fromClient.wallet.getUnusedAddress()).address
      secret = await fromClient.swap.generateSecret('test')
      secretHash = sha256(secret)

      swapExpiration = quote.swapExpiration
      nodeSwapExpiration = quote.nodeSwapExpiration

      const args = [
        quote.fromAmount,
        quote.fromCounterPartyAddress,
        fromAddress,
        secretHash,
        swapExpiration
      ]

      return toClient.chain.getBlockHeight().then(blockNumber => {
        fromBlock = blockNumber

        return fromClient.swap.initiateSwap(...args).then(hash => {
          fromFundHash = hash
        })
      })
    })

    it('should confirm the quote', async () => {
      toAddress = (await toClient.wallet.getUnusedAddress()).address

      return chai.request(app())
        .post(`/api/swap/order/${quote.orderId}`)
        .send({
          fromAddress,
          toAddress,
          fromFundHash,
          secretHash,
          swapExpiration,
          nodeSwapExpiration
        })
        .then(res => {
          res.should.have.status(200)
          res.body.should.be.a('object')

          res.body.orderId.should.equal(quote.orderId)
          res.body.from.should.equal(from)
          res.body.to.should.equal(to)
          res.body.fromAmount.should.equal(fromAmount)
          res.body.status.should.equal('USER_FUNDED_UNVERIFIED')

          quote = res.body
        })
    })

    it('should not allow update to already funded quote', async () => {
      // try updating the quote with random data
      return chai.request(app())
        .post(`/api/swap/order/${quote.orderId}`)
        .send({
          fromAddress: '0x572E7610B0FC9a00cb4A441F398c9C7a5517DE32',
          toAddress: 'bcrt1qjywshhj05s0lan3drpv9cu7t595y7k5x00ttf8',
          fromFundHash: '98241f985c22fa523028f5fbc7d61305f8ee11fce7c334f015a470f292624948',
          secretHash: '122f75aa0dbfb90db7984fe82400888443eacca84d388c7a93d976c640864e01'
        })
        .then(res => {
          res.should.have.status(401)
        })
    })

    it('should verify funding of the quote', async function () {
      this.timeout(30 * 1000)

      const check = () => sleep(1000).then(() => chai.request(app())
        .get(`/api/swap/order/${quote.orderId}`)
        .then(res => {
          res.should.have.status(200)

          if (res.body.status === 'USER_FUNDED_UNVERIFIED') {
            return check()
          }

          // if agent funds immediately, status will be AGENT_FUNDED instead of USER_FUNDED
          res.body.status.should.be.oneOf(['USER_FUNDED', 'AGENT_FUNDED'])
        }))

      return check()
    })

    it('should reciprocate by funding the swap', async function () {
      this.timeout(30 * 1000)

      const check = () => sleep(1000).then(() => chai.request(app())
        .get(`/api/swap/order/${quote.orderId}`)
        .then(res => {
          res.should.have.status(200)

          if (res.body.status === 'USER_FUNDED') {
            return check()
          }

          res.body.status.should.equal('AGENT_FUNDED')
        }))

      return check()
    })

    it('should find the agent\'s funding tx', async function () {
      this.timeout(90 * 1000)

      const findInitSwapTx = async (startBlock, endBlock) => {
        if (startBlock > endBlock) {
          throw new Error('No init swap tx found')
        }

        try {
          const initSwapTx = await toClient.swap.findInitiateSwapTransaction(
            quote.toAmount,
            quote.toAddress,
            quote.toCounterPartyAddress,
            quote.secretHash,
            quote.nodeSwapExpiration,
            startBlock
          )

          if (initSwapTx) return initSwapTx

          return findInitSwapTx(startBlock + 1, endBlock)
        } catch (e) {
          if (e.message.includes('Block height out of range')) {
            return sleep(5000).then(() => findInitSwapTx(startBlock, endBlock))
          }

          throw e
        }
      }

      return toClient.chain.getBlockHeight()
        .then(blockNumber => findInitSwapTx(fromBlock, blockNumber + 5))
        .then(tx => (toInitSwapTxHash = tx.hash))
    })
  })

  describe(refund ? 'Refund' : (lateClaim ? 'Late claim' : 'Claim'), () => {
    if (!refund || lateClaim) {
      before(async function () {
        this.timeout(120 * 1000)

        await sleep(lateClaim ? 60 * 1000 : 10 * 1000)

        return toClient.swap.claimSwap(toInitSwapTxHash, toAddress, quote.toCounterPartyAddress, secret, nodeSwapExpiration)
      })
    }

    it(`should ${refund ? 'refund' : 'claim'} the swap`, async function () {
      this.timeout(120 * 1000)

      const expectedStatus = refund ? 'AGENT_REFUNDED' : 'AGENT_CLAIMED'

      const check = () => sleep(1000).then(() => chai.request(app())
        .get(`/api/swap/order/${quote.orderId}`)
        .then(res => {
          res.should.have.status(200)

          if (['AGENT_FUNDED', 'USER_CLAIMED'].includes(res.body.status)) {
            return check()
          }

          res.body.status.should.equal(expectedStatus)
        }))

      return check()
    })
  })
}
