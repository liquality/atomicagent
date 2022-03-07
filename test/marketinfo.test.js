/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const { app } = require('../src/api')
const { prepare } = require('./lib/utils')

describe('Market Info', () => {
  before(async function () {
    this.timeout(0)
    await prepare()
  })

  it('should get all the markets', async () => {
    return chai
      .request(app())
      .get('/api/swap/marketinfo')
      .then((res) => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        res.body.length.should.be.eql(6) // for tests, we only check for ETH, BTC markets
      })
  })
})
