let chai = require('chai');
let chaiHttp = require('chai-http');

let should = chai.should();

chai.use(chaiHttp);

//var server = "https://virtserver.swaggerhub.com/monokh/liquality-agent/1.0.0/swap";
var server = "http://localhost:3030/api/swap";


describe('marketinfo', () => {
  beforeEach((done) => { //Before each test we empty the database
 //   console.log("Before")
    done();
  });

  describe('/GET marketinfo', () => {
    it('it should GET all the assets', (done) => {
      chai.request(server)
        .get('/marketinfo')
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('array');
          res.body.length.should.be.eql(3);
          done();
        });
    });
  });

  describe('/POST order', () => {
    var quote = {}

    it('it should POST to get a quote', (done) => {
      chai.request(server)
        .post('/order')
        .send({
          "from": "BTC",
          "to": "ETH",
          "fromAmount": 5000000
        })
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          quote = res;
          done();
        });
    });

    it('it should GET information by quote id', (done) => {
      chai.request(server)
        .get('/order/' + quote.body.orderId)
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          res.body.orderId.should.equal(quote.body.orderId);
          done();
        });
    });

    it('it should POST to confirm the quote', (done) => {
      chai.request(server)
        .post('/order/' + quote.body.orderId)
        .send({
          "fromAddress": "0x572E7610B0FC9a00cb4A441F398c9C7a5517DE32",
          "toAddress": "bcrt1qjywshhj05s0lan3drpv9cu7t595y7k5x00ttf8",
          "fromFundHash": "98241f985c22fa523028f5fbc7d61305f8ee11fce7c334f015a470f292624948",
          "secretHash": "122f75aa0dbfb90db7984fe82400888443eacca84d388c7a93d976c640864e01",
          "swapExpiration": 1566603605
        })
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.a('object');
          done();
        });
    });
  });

})
