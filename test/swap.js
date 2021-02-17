/* eslint-env mocha */
const chai = require('chai')
const Bluebird = require('bluebird')
const chaiHttp = require('chai-http')
const humanInterval = require('human-interval')
chai.should()
chai.use(chaiHttp)

const { app } = require('../src/api')
const { wait } = require('../src/utils/chainLock')
const config = require('../src/config')

const {
  requestQuote,
  testQuote,
  initiate,
  fund,
  verifyInitiate,
  verifyAgentFunding,
  findAgentFundingTx,
  claim,
  refundSwap,
  verifyClaimOrRefund,
  verifyUserRefund,
  verifyAllTxs,
  approveOrder
} = require('./utils')

module.exports = (contexts, { refund, reject }) => {
  describe('Quote', () => {
    it('should refuse quote with invalid amount', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context =>
        request
          .post('/api/swap/order')
          .send({
            from: context.from,
            to: context.to,
            fromAmount: 10000
          })
          .then(res => res.should.have.status(400)))
        .then(() => request.close())
    })

    it('should accept a quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => requestQuote(context, request))
        .then(() => request.close())
    })

    it('should get quote by id', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => testQuote(context, request))
        .then(() => request.close())
    })

    it('should throw an error when quote id is incorrect', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context =>
        request.get('/api/swap/order/abc')
          .then(res => res.should.have.status(400)))
        .then(() => request.close())
    })
  })

  describe('Swap', () => {
    it('should confirm the quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      async function fundContext (context, request) {
        try {
          await fund(context, request)
        } catch (e) {
          if (e.name === 'RescheduleError') {
            return wait(5000).then(() => fundContext(context, request))
          }

          throw e
        }
      }

      return Bluebird.map(contexts, async context => {
        await initiate(context, request)
        await fundContext(context, request)
      }).then(() => request.close())
    })

    it('should verify funding of the quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => verifyInitiate(context, request))
        .then(() => request.close())
    })

    it('should not allow update to already funded quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context =>
        request
          .post(`/api/swap/order/${context.orderId}`)
          .send({
            fromAddress: '0x572E7610B0FC9a00cb4A441F398c9C7a5517DE32',
            toAddress: 'bcrt1qjywshhj05s0lan3drpv9cu7t595y7k5x00ttf8',
            fromFundHash: '98241f985c22fa523028f5fbc7d61305f8ee11fce7c334f015a470f292624948',
            secretHash: '122f75aa0dbfb90db7984fe82400888443eacca84d388c7a93d976c640864e01'
          })
          .then(res => res.should.have.status(400)))
        .then(() => request.close())
    })

    if (!reject) {
      it('should reciprocate by funding the swap', async function () {
        this.timeout(0)

        await Bluebird.map(contexts, context => approveOrder(context), { concurrency: 2 })

        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, context => verifyAgentFunding(context, request))
          .then(() => request.close())
      })

      it('should find the agent\'s funding tx', async function () {
        this.timeout(0)

        return Bluebird.map(contexts, context => findAgentFundingTx(context))
      })
    }
  })

  if (reject) {
    describe('NOOP', () => {
      it('should ignore the swap', async function () {
        this.timeout(0)

        const expectedStatus = 'USER_FUNDED'
        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, context => verifyClaimOrRefund(context, request, expectedStatus))
      })
    })
  } else {
    describe(refund ? 'Refund' : 'Claim', () => {
      if (!refund) {
        before(async function () {
          this.timeout(0)

          return Bluebird.map(contexts, context => claim(context))
        })
      }

      it(`should ${refund ? 'refund' : 'claim'} the swap`, async function () {
        this.timeout(0)

        const expectedStatus = refund ? 'AGENT_REFUNDED' : 'AGENT_CLAIMED'
        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, context => verifyClaimOrRefund(context, request, expectedStatus))
      })
    })
  }

  if (refund && !reject) {
    describe('Verify user refund', () => {
      before(async function () {
        this.timeout(0)

        const maxSwapExpiration = Math.max(...contexts.map(context => context.swapExpiration))
        const maxBlockTime = Math.max(...contexts.map(context => humanInterval(config.assets[context.from].blockTime)))
        const waitFor = ((maxSwapExpiration * 1000) - Date.now()) + (maxBlockTime * 2)

        console.log(`[user] Waiting for ${waitFor}ms before attempting refund`)
        await wait(waitFor)
        console.log('[user] Attempting refund now')

        return Bluebird.map(contexts, context => refundSwap(context))
      })

      it('should verify refund', async function () {
        this.timeout(0)

        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, context => verifyUserRefund(context, request))
      })
    })
  }

  describe('Verify all transactions', () => {
    it('should verify all transactions', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => verifyAllTxs(context, request))
    })
  })
}
