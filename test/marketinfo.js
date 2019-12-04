/* eslint-env mocha */
const chai = require('chai')
const should = chai.should()
const chaiHttp = require('chai-http')

const { prepare, mongoose } = require('./utils')

chai.use(chaiHttp)

const { app } = require('../src/api')

describe('Market Info', () => {
  before(() => prepare())

  it('should get all the assets', async () => {
    return chai.request(app())
      .get('/api/swap/marketinfo')
      .then(res => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        res.body.length.should.be.eql(3)
      })
  })

  it('should find update-market-data job', async function () {
    const job = await mongoose.connection.db.collection('agendaJobs')
      .findOne({ name: 'update-market-data', repeatInterval: '5 minutes' })

    should.exist(job)
  })
})
