/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

function testLenderAgentInfo () {
  describe('/GET agentinfo/:marketId', () => {
    it('should GET current agent addresses from marketId', async () => {
      const { body: loanMarkets } = await chai.request(server).get('/loanmarketinfo')
      const { body: addresses } = await chai.request(server).get(`/agentinfo/${loanMarkets[0].id}`)
      const { principalAddress } = addresses

      expect(principalAddress.length / 2).to.equal(21)
    })
  })
}

describe('Lender Agent - Agent Info', () => {
  testLenderAgentInfo()
})
