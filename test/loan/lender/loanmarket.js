/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

function testLenderLoanMarket () {
  describe('/GET loanmarketinfo', () => {
    it('should GET all the loan markets', async () => {
      const { body, status } = await chai.request(server).get('/loanmarketinfo')

      expect(status).to.equal(200)
      expect(body).to.be.a('array')
      expect(body.length).to.equal(2)
    })
  })
}

describe('Lender Agent - Loan Market', () => {
  testLenderLoanMarket()
})
