const getWeb3 = require('./web3')

const schema = {}

schema.funds = require('../abi/funds')
schema.loans = require('../abi/loans')
schema.sales = require('../abi/sales')
schema.erc20 = require('../abi/erc20')

function loadObject (type, address) {
  const web3 = getWeb3()
  return new web3.eth.Contract(schema[type].abi, address)
}

module.exports = {
  loadObject
}
