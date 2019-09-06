/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const BN = require('bignumber.js')
const { checksumEncode } = require('@liquality/ethereum-utils')
const { chains, connectMetaMask } = require('../common')
const web3 = require('../../src/utils/web3')
const { toWei } = web3.utils

chai.should()
const expect = chai.expect

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

describe('loanmarketinfo', () => {
  describe('/GET loanmarketinfo', () => {
    it('should GET all the loan markets', (done) => {
      chai.request(server)
        .get('/loanmarketinfo')
        .end((_, res) => {
          res.should.have.status(200)
          res.body.should.be.a('array')
          res.body.length.should.be.eql(2)
          done()
        })
    })
  })

  describe('/GET agentinfo/:marketId', () => {
    it('should GET current agent addresses from marketId', async () => {
      const { body: loanMarkets } = await chai.request(server).get('/loanmarketinfo')
      const { body: addresses } = await chai.request(server).get(`/agentinfo/${loanMarkets[0].id}`)
      const { principalAddress } = addresses

      expect(principalAddress.length / 2).to.equal(20)
    })
  })

  describe('Withdraw excess funds', () => {
    connectMetaMask()

    it('should return eth to metamask user if ETH_SIGNER', async () => {
      const timestamp = Math.floor(new Date().getTime() / 1000)
      const amount = 1
      const currency = 'ETH'
      const address = checksumEncode((await chains.ethereumWithMetaMask.client.wallet.getAddresses())[0].address)
      const message = `Withdraw ${amount} ${currency} to ${address} at ${timestamp}`

      await chains.ethereumWithNode.client.chain.sendTransaction(address, toWei(amount.toString(), 'ether'))

      const signature = await chains.ethereumWithMetaMask.client.wallet.signMessage(message)
      const balanceBefore = await chains.ethereumWithNode.client.chain.getBalance(address)

      await chai.request(server).post('/withdraw').send({ currency, timestamp, signature, amount, message })

      const balanceAfter = await chains.ethereumWithNode.client.chain.getBalance(address)

      expect(BN(balanceAfter).toFixed()).to.equal(BN(balanceBefore).plus(BN(toWei(amount.toString(), 'ether'))).toFixed())
    })
  })
})
