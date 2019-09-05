let chai = require('chai');
let chaiHttp = require('chai-http');

let should = chai.should();
let expect = chai.expect;

chai.use(chaiHttp);

var server = "http://localhost:3030/api/loan";


describe('loanmarketinfo', () => {
  beforeEach((done) => { //Before each test we empty the database
 //   console.log("Before")
    done();           
  });

  describe('/GET loanmarketinfo', () => {
    it('should GET all the loan markets', (done) => {
      chai.request(server)
        .get('/loanmarketinfo')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
          res.body.length.should.be.eql(2);
          done();
        });
    });
  });

  describe('/GET agentinfo/:marketId', () => {
    it('should GET current agent addresses from marketId', async () => {
      const { body: loanMarkets } = await chai.request(server).get('/loanmarketinfo')
      const { body: addresses } = await chai.request(server).get(`/agentinfo/${loanMarkets[0].id}`)
      const { principalAddress, collateralAddress } = addresses

      expect(principalAddress.length / 2).to.equal(20)
    })
  })
})
