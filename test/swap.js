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
  verifyInitiate,
  verifyAgentFunding,
  findAgentFundingTx,
  claim,
  refundSwap,
  verifyClaimOrRefund,
  verifyUserRefund,
  verifyAllTxs
} = require('./utils')

module.exports = (contexts, refund) => {
  describe('Quote', () => {
    it('should refuse quote with invalid amount', async function () {
      this.timeout(10 * 1000)

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
      this.timeout(10 * 1000)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => requestQuote(context, request))
        .then(() => request.close())
    })

    it('should get quote by id', async function () {
      this.timeout(10 * 1000)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => testQuote(context, request))
        .then(() => request.close())
    })

    it('should throw an error when quote id is incorrect', async function () {
      this.timeout(10 * 1000)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context =>
        request.get('/api/swap/order/abc')
          .then(res => res.should.have.status(400)))
        .then(() => request.close())
    })
  })

  describe('Swap', () => {
    it('should confirm the quote', async function () {
      this.timeout(120 * 1000)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => initiate(context, request))
        .then(() => request.close())
    })

    it('should verify funding of the quote', async function () {
      this.timeout(120 * 1000)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => verifyInitiate(context, request))
        .then(() => request.close())
    })

    it('should not allow update to already funded quote', async function () {
      this.timeout(10 * 1000)

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

    it('should reciprocate by funding the swap', async function () {
      this.timeout(120 * 1000)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => verifyAgentFunding(context, request))
        .then(() => request.close())
    })

    it('should find the agent\'s funding tx', async function () {
      this.timeout(120 * 1000)

      return Bluebird.map(contexts, context => findAgentFundingTx(context))
    })
  })

  describe(refund ? 'Refund' : 'Claim', () => {
    if (!refund) {
      before(async function () {
        this.timeout(120 * 1000)

        return Bluebird.map(contexts, context => claim(context))
      })
    }

    it(`should ${refund ? 'refund' : 'claim'} the swap`, async function () {
      this.timeout(500 * 1000)

      const expectedStatus = refund ? 'AGENT_REFUNDED' : 'AGENT_CLAIMED'
      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => verifyClaimOrRefund(context, request, expectedStatus))
    })
  })

  if (refund) {
    describe('Verify user refund', () => {
      before(async function () {
        this.timeout(200 * 1000)

        const maxSwapExpiration = Math.max(...contexts.map(context => context.swapExpiration))
        const maxBlockTime = Math.max(...contexts.map(context => humanInterval(config.assets[context.from].blockTime)))
        const waitFor = ((maxSwapExpiration * 1000) - Date.now()) + (maxBlockTime * 2)

        await wait(waitFor)

        return Bluebird.map(contexts, context => refundSwap(context))
      })

      it('should verify refund', async function () {
        this.timeout(200 * 1000)

        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, context => verifyUserRefund(context, request))
      })
    })
  }

  describe('Verify all transactions', () => {
    it('should verify all transactions', async function () {
      this.timeout(200 * 1000)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, context => verifyAllTxs(context, request))
    })
  })
}
