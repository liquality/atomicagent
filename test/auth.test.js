/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const { app } = require('../src/api')
const { prepare } = require('./lib/utils')
const config = require('../src/config')

describe('Test Order retry Auth', () => {
  before(async function () {
    this.timeout(0)
    await prepare()
  })

  it('Should return 401 without bearer token', async () => {
    return chai
      .request(app())
      .get('/api/user/order/retry?orderId=' + '123213234')
      .then((res) => {
        res.should.have.status(401)
      })
  })

  it('Should return Order not found for invalid orderId', async () => {
    return chai
      .request(app())
      .get('/api/user/order/retry?orderId=' + '123213234')
      .set('Authorization', config.auth.bearer)
      .then((res) => {
        res.should.have.status(400)
      })
  })
})
