/* eslint-env mocha */
const chai = require('chai')
const should = chai.should()
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const Job = require('../src/models/Job')
const { app } = require('../src/api')
const { prepare } = require('./utils')

describe('Market Info', () => {
  before(async function () {
    this.timeout(30000)

    await prepare()
  })

  it('should get all the markets', async () => {
    return chai.request(app())
      .get('/api/swap/marketinfo')
      .then(res => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        res.body.length.should.be.eql(6) // for tests, we only check for ETH, BTC markets
      })
  })

  it('should find update-market-data job', async function () {
    const job = await Job.findOne({ name: 'update-market-data', repeatInterval: '30 seconds' }).exec()

    should.exist(job)
  })
})
