const schema = {}

schema.funds = require('../../../src/abi/funds')
schema.loans = require('../../../src/abi/loans')
schema.sales = require('../../../src/abi/sales')
schema.ctoken = require('../../../src/abi/ctoken')
schema.erc20 = require('../../../src/abi/erc20')

function testLoadObject (type, address, chain, from) {
  if (from) {
    return new chain.client.eth.Contract(schema[type].abi, address, { from })
  } else {
    return new chain.client.eth.Contract(schema[type].abi, address)
  }
}

module.exports = {
  testLoadObject
}
