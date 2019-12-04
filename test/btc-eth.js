/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const { sha256 } = require('@liquality/crypto')

const { prepare, sleep } = require('./utils')
const { getClient } = require('../src/utils/clients')

chai.should()
chai.use(chaiHttp)

const { app } = require('../src/api')

describe('BTC -> ETH', () => {
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

  before(() => prepare())

  describe('POST /api/swap/order', () => {
    describe('Quote', () => {
      it('should refuse quote with invalid amount', async () => {
        return chai.request(app())
          .post('/api/swap/order')
          .send({
            from: 'BTC',
            to: 'ETH',
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
            from: 'BTC',
            to: 'ETH',
            fromAmount: 5000000
          })
          .then(res => {
            res.should.have.status(200)
            res.body.should.be.a('object')

            res.body.from.should.equal('BTC')
            res.body.to.should.equal('ETH')
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
            res.body.from.should.equal('BTC')
            res.body.to.should.equal('ETH')
            res.body.fromAmount.should.equal(5000000)
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
        swapExpiration = Math.ceil(Date.now() / 1000) + (60 * 60 * 12) // 12 hour from now

        const args = [
          quote.fromAmount,
          quote.fromCounterPartyAddress,
          fromAddress,
          secretHash,
          swapExpiration
        ]

        fromFundHash = await fromClient.swap.initiateSwap(...args)
      })

      it('should confirm the quote', async () => {
        toAddress = (await toClient.wallet.getUnusedAddress()).address

        return toClient.chain.getBlockHeight().then(blockNumber => {
          fromBlock = blockNumber

          return chai.request(app())
            .post(`/api/swap/order/${quote.orderId}`)
            .send({
              fromAddress,
              toAddress,
              fromFundHash,
              secretHash,
              swapExpiration
            })
            .then(res => {
              res.should.have.status(200)
              res.body.should.be.a('object')

              res.body.orderId.should.equal(quote.orderId)
              res.body.from.should.equal('BTC')
              res.body.to.should.equal('ETH')
              res.body.fromAmount.should.equal(5000000)
              res.body.status.should.equal('USER_FUNDED_UNVERIFIED')

              quote = res.body
            })
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

        const check = () => sleep(5000).then(() => chai.request(app())
          .get(`/api/swap/order/${quote.orderId}`)
          .then(res => {
            res.should.have.status(200)

            if (res.body.status === 'AGENT_PENDING') {
              return check()
            }

            res.body.status.should.equal('USER_FUNDED')
          }))

        return check()
      })

      it('should reciprocate by funding the swap', async function () {
        this.timeout(30 * 1000)

        const check = () => sleep(5000).then(() => chai.request(app())
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

      it('should find the agent\'s funding tx', async () => {
        const findInitSwapTx = async (startBlock, endBlock) => {
          if (startBlock > endBlock) {
            throw new Error('No init swap tx found')
          }

          const initSwapTx = await toClient.swap.findInitiateSwapTransaction(
            quote.toAmount,
            quote.toAddress,
            quote.toCounterPartyAddress,
            quote.secretHash,
            quote.swapExpiration - (60 * 60 * 6),
            startBlock
          )

          if (initSwapTx) return initSwapTx

          return findInitSwapTx(startBlock + 1, endBlock)
        }

        return toClient.chain.getBlockHeight()
          .then(blockNumber => findInitSwapTx(fromBlock, blockNumber))
          .then(tx => (toInitSwapTxHash = tx.hash))
      })
    })

    describe('Claim', () => {
      before(async () => {
        return toClient.swap.claimSwap(toInitSwapTxHash, toAddress, quote.toCounterPartyAddress, secret, swapExpiration)
      })

      it('should claim the swap', async function () {
        this.timeout(30 * 1000)

        const check = () => sleep(5000).then(() => chai.request(app())
          .get(`/api/swap/order/${quote.orderId}`)
          .then(res => {
            res.should.have.status(200)

            if (res.body.status === 'USER_CLAIMED') {
              return check()
            }

            res.body.status.should.equal('AGENT_CLAIMED')
          }))

        return check()
      })
    })
  })
})
