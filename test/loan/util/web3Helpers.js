const { checksumEncode } = require('@liquality/ethereum-utils')

async function getWeb3Address (web3Chain) {
  if (web3Chain.id === 'Web3 MetaMask') {
    return checksumEncode((await web3Chain.client.eth.getAccounts())[0])
  } else {
    return checksumEncode((await web3Chain.client.currentProvider.getAddresses())[0])
  }
}

module.exports = {
  getWeb3Address
}
