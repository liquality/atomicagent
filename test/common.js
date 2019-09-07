const config = require('./config')
const { Client, providers } = require('@liquality/bundle')
const MetaMaskConnector = require('node-metamask')
const Web3 = require('web3')

const metaMaskConnector = new MetaMaskConnector({ port: config.ethereum.metaMaskConnector.port })

const ethereumWithNode = new Client()
ethereumWithNode.addProvider(new providers.ethereum.EthereumRpcProvider(config.ethereum.rpc.host))

const ethereumWithMetaMask = new Client()
ethereumWithMetaMask.addProvider(new providers.ethereum.EthereumRpcProvider(config.ethereum.rpc.host))
ethereumWithMetaMask.addProvider(new providers.ethereum.EthereumMetaMaskProvider(metaMaskConnector.getProvider()))

const web3WithMetaMask = new Web3(metaMaskConnector.getProvider())

const chains = {
  ethereumWithNode: { id: 'Ethereum Node', name: 'ethereum', client: ethereumWithNode },
  ethereumWithMetaMask: { id: 'Ethereum MetaMask', name: 'ethereum', client: ethereumWithMetaMask },
  web3WithMetaMask: { id: 'Web3 MetaMask', name: 'ethereum', client: web3WithMetaMask }
}

function connectMetaMask () {
  before(async () => {
    console.log('\x1b[36m', 'Starting MetaMask connector on http://localhost:3333 - Open in browser to continue', '\x1b[0m')
    await metaMaskConnector.start()
  })
  after(async () => metaMaskConnector.stop())
}

module.exports = {
  chains,
  connectMetaMask
}
