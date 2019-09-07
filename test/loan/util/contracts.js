const { chains } = require('../../common')

const schema = {}

schema.funds = require('../../../src/abi/funds')
schema.loans = require('../../../src/abi/loans')
schema.sales = require('../../../src/abi/sales')
schema.erc20 = require('../../../src/abi/erc20')

function testLoadObject (type, address, from) {
  return new chains.web3WithMetaMask.client.eth.Contract(schema[type].abi, address, { from })
}

module.exports = {
  testLoadObject
}
