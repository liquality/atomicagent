/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const { app } = require('../src/api')
const { prepare } = require('./lib/utils')

describe('Asset Info', () => {
  before(async function () {
    this.timeout(0)
    await prepare()
  })

  it('should get all the assets', async () => {
    return chai.request(app())
      .get('/api/swap/assetinfo')
      .then(res => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        res.body.length.should.be.eql(3)
      })
  })
})
