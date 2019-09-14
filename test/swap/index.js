/* eslint-env mocha */
const chai = require('chai')
const chaiHttp = require('chai-http')

chai.should()

chai.use(chaiHttp)

var server = 'https://virtserver.swaggerhub.com/monokh/liquality-agent/1.0.0/swap'

describe('marketinfo', () => {
  beforeEach((done) => { // Before each test we empty the database
    //   console.log("Before")
    done()
  })

  describe('/GET marketinfo', () => {
    it('it should GET all the assets', (done) => {
      chai.request(server)
        .get('/marketinfo')
        .end((_, res) => {
          res.should.have.status(200)
          res.body.should.be.a('array')
          res.body.length.should.be.eql(1)
          done()
        })
    })
  })

  describe('/POST order', () => {
    it('it should POST to get a quote', (done) => {
      chai.request(server)
        .post('/order')
        .send({
          from: 'BTC',
          to: 'ETH',
          amount: 0.51
        })
        .end((_, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
          done()
        })
    })
  })

  describe('/POST order', () => {
    it('it should POST to get a quote', (done) => {
      chai.request(server)
        .post('/order')
        .send({
          amount: 0.01,
          fromAddress: 'mgxDATSdgJ3eYSj7ukYeN6QNr7gofUa3Tk',
          toAddress: '0x342800907eE13A0c7Bd9d6ebA13A417ba79c5b0b',
          fundHash: '39eaf9d29d118478187ce164a5baf9429dd805ef5e4c5f4387719207295a90d0',
          secretHash: '16d54b643a30110ec13b4122231a0981dae0c3f8e94642222d85d98179e1b5a8',
          swapExpiration: 1562386069
        })
        .end((_, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
          done()
        })
    })
  })

  describe('/GET order by id eae4d76c-3ba2-465d-930b-324fcbe17d95', () => {
    it('it should GET the status of a quote by id', (done) => {
      chai.request(server)
        .get('/order/eae4d76c-3ba2-465d-930b-324fcbe17d95')
        .end((_, res) => {
          res.should.have.status(200)
          res.body.should.be.a('object')
          done()
        })
    })
  })
})
