const web3 = require('./web3')

const schema = {};

schema.funds = require("../abi/funds");
schema.loans = require("../abi/loans");
schema.sales = require("../abi/sales");

export const loadObject = (type, address) => {
  return web3.eth.contract(schema[type].abi).at(address);
}
