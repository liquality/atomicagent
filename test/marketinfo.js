/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')

const { prepare } = require('./utils')

chai.should()
chai.use(chaiHttp)

const app = require('../src/api')

describe('Market Info', () => {
  before(() => prepare())

  it('should get all the assets', async () => {
    return chai.request(app)
      .get('/api/swap/marketinfo')
      .then(res => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        res.body.length.should.be.eql(3)
      })
  })
})
