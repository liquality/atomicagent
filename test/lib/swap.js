/* eslint-env mocha */
const chai = require('chai')
const Bluebird = require('bluebird')
const chaiHttp = require('chai-http')
chai.should()
chai.use(chaiHttp)

const { app } = require('../../src/api')
const { wait } = require('../../src/utils/chainLock')

const {
  requestQuote,
  testQuote,
  userInitiate,
  userApprove,
  verifyAgentInitiation,
  verifyAgentFunding,
  findAgentFundingTx,
  userClaim,
  verifyAgentClaimOrRefund,
  verifyAllTxs,
  approveOrder,
  updateAgentOrder
} = require('./utils')

module.exports = (contexts, { refund, reject }) => {
  describe('Quote', () => {
    it('should refuse quote with invalid amount', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, (context) =>
        request
          .post('/api/swap/order')
          .send({
            from: context.from,
            to: context.to,
            fromAmount: 10000
          })
          .then((res) => res.should.have.status(400))
      ).then(() => request.close())
    })

    it('should accept a quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, (context) => requestQuote(context, request)).then(() => request.close())
    })

    it('should get quote by id', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, (context) => testQuote(context, request)).then(() => request.close())
    })

    it('should throw an error when quote id is incorrect', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, () =>
        request.get('/api/swap/order/abc').then((res) => res.should.have.status(400))
      ).then(() => request.close())
    })
  })

  describe('Swap', () => {
    it('should confirm the quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      async function approveContext(context, request) {
        try {
          await userApprove(context, request)
        } catch (e) {
          if (e.name === 'RescheduleError') {
            return wait(5000).then(() => approveContext(context, request))
          }

          throw e
        }
      }

      return Bluebird.map(contexts, async (context) => {
        await approveContext(context, request)
        await userInitiate(context, request)
      }).then(() => request.close())
    })

    it('should reject duplicate fromFundHash', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, async (context) => {
        const ctx = {
          from: context.from,
          to: context.to,
          fromAmount: context.fromAmount
        }

        await requestQuote(ctx, request)

        ctx.fromAddress = context.fromAddress
        ctx.toAddress = context.toAddress
        ctx.secretHash = context.secretHash
        ctx.fromFundHash = context.fromFundHash

        return updateAgentOrder(ctx, request, true)
      }).then(() => request.close())
    })

    it('should verify funding of the quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, (context) => verifyAgentInitiation(context, request)).then(() => request.close())
    })

    it('should not allow update to already funded quote', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, (context) =>
        request
          .post(`/api/swap/order/${context.orderId}`)
          .send({
            fromAddress: '0x572E7610B0FC9a00cb4A441F398c9C7a5517DE32',
            toAddress: 'bcrt1qjywshhj05s0lan3drpv9cu7t595y7k5x00ttf8',
            fromFundHash: '98241f985c22fa523028f5fbc7d61305f8ee11fce7c334f015a470f292624948',
            secretHash: '122f75aa0dbfb90db7984fe82400888443eacca84d388c7a93d976c640864e01'
          })
          .then((res) => res.should.have.status(400))
      ).then(() => request.close())
    })

    if (!reject) {
      it('should reciprocate by funding the swap', async function () {
        this.timeout(0)

        await Bluebird.map(contexts, (context) => approveOrder(context), {
          concurrency: 2
        })

        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, (context) => verifyAgentFunding(context, request)).then(() => request.close())
      })

      it("should find the agent's funding tx", async function () {
        this.timeout(0)

        return Bluebird.map(contexts, (context) => findAgentFundingTx(context))
      })
    }
  })

  if (reject) {
    describe('NOOP', () => {
      it('should ignore the swap', async function () {
        this.timeout(0)

        const expectedStatus = 'USER_FUNDED'
        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, (context) => verifyAgentClaimOrRefund(context, request, expectedStatus))
      })
    })
  } else {
    describe(refund ? 'Refund' : 'Claim', () => {
      if (!refund) {
        before(async function () {
          this.timeout(0)
          return Bluebird.map(contexts, (context) => {
            try {
              return userClaim(context)
            } catch (e) {
              if (e.name === 'RescheduleError') {
                return wait(5000).then(() => userClaim(context))
              }

              throw e
            }
          })
        })
      }

      it(`should ${refund ? 'refund' : 'claim'} the swap`, async function () {
        this.timeout(0)

        const expectedStatus = refund ? 'AGENT_REFUNDED' : 'AGENT_CLAIMED'
        const request = chai.request(app()).keepOpen()

        return Bluebird.map(contexts, (context) => verifyAgentClaimOrRefund(context, request, expectedStatus))
      })
    })
  }

  describe('Verify all transactions', () => {
    it('should verify all transactions', async function () {
      this.timeout(0)

      const request = chai.request(app()).keepOpen()

      return Bluebird.map(contexts, (context) => verifyAllTxs(context, request))
    })
  })
}
