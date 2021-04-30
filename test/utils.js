/* eslint-env mocha */
const debug = require('debug')('liquality:agent:test')
const chai = require('chai')
const chaiHttp = require('chai-http')
chai.should()
chai.use(chaiHttp)
const BN = require('bignumber.js')

const { expect } = chai

const { v4: uuidv4 } = require('uuid')
const mongoose = require('mongoose')
const { ClientFactory } = require('@liquality/client-factory')
const { sha256 } = require('@liquality/crypto')

const api = require('../src/api')
const worker = require('../src/worker')
const config = require('../src/config')

const Asset = require('../src/models/Asset')
const Market = require('../src/models/Market')
const MarketHistory = require('../src/models/MarketHistory')
const Job = require('../src/models/Job')
const Order = require('../src/models/Order')
const Check = require('../src/models/Check')

const assets = require('../src/migrate/data/assets.json')
const markets = require('../src/migrate/data/markets.json')

const blockScanOrFind = require('../src/utils/blockScanOrFind')
const { wait, waitForRandom, withLock } = require('../src/utils/chainLock')

const btcPreset = require('./client-presets/btc')
const ethPreset = require('./client-presets/eth')
const erc20Preset = require('./client-presets/erc20')

const presets = {
  BTC: btcPreset,
  ETH: ethPreset,
  DAI: erc20Preset
}

const getClient = function (asset) {
  const preset = presets[asset]

  const client = ClientFactory.createFrom(preset, {
    mnemonic: 'test wallet',
    assetConfig: config.assets[asset]
  })

  return client
}

module.exports.getClient = getClient

const clearJobs = () => Job.deleteMany({})
  .then(() => debug('Cleared Job collection'))

module.exports.clearJobs = clearJobs

const clear = () => clearJobs()
  .then(() => Order.deleteMany({}))
  .then(() => debug('Cleared Order collection'))
  .then(() => Check.deleteMany({}))
  .then(() => debug('Cleared Check collection'))
  .then(() => Asset.deleteMany({}))
  .then(() => Asset.insertMany(assets, { ordered: false }))
  .then(() => debug('Reinstalled Asset collection'))
  .then(() => Market.deleteMany({}))
  .then(() => Market.insertMany(markets.filter(
    market => ['BTC', 'ETH', 'DAI'].includes(market.from) && ['BTC', 'ETH', 'DAI'].includes(market.to)
  ), { ordered: false }))
  .then(() => debug('Reinstalled Market collection'))
  .then(() => MarketHistory.deleteMany({}))
  .then(() => debug('Cleared MarketHistory collection'))
  .then(() => Market.updateAllMarketData())
  .then(() => debug('Updated marketdata'))

module.exports.prepare = () => mongoose
  .connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })
  .then(() => module.exports.deployAndMintMidman())
  .then(() => clear())
  .then(() => api.start())
  .then(() => worker.start())
  .then(() => waitForRandom(3500, 5000))
  .then(() => debug('Started api & worker'))

module.exports.requestQuote = async (context, request) => {
  return request
    .post('/api/swap/order')
    .send({
      from: context.from,
      to: context.to,
      fromAmount: context.fromAmount
    })
    .then(res => {
      res.should.have.status(200)
      res.body.should.be.a('object')

      res.body.from.should.equal(context.from)
      res.body.to.should.equal(context.to)

      res.body.swapExpiration.should.be.a('number')
      res.body.nodeSwapExpiration.should.be.a('number')

      res.body.status.should.equal('QUOTE')

      Object.assign(context, res.body)
    })
}

module.exports.testQuote = async (context, request) => {
  return request
    .get(`/api/swap/order/${context.orderId}`)
    .then(res => {
      res.should.have.status(200)
      res.body.should.be.a('object')

      res.body.orderId.should.equal(context.orderId)

      res.body.from.should.equal(context.from)
      res.body.to.should.equal(context.to)

      res.body.fromAmount.should.equal(context.fromAmount)

      res.body.swapExpiration.should.equal(context.swapExpiration)
      res.body.nodeSwapExpiration.should.equal(context.nodeSwapExpiration)

      res.body.status.should.equal('QUOTE')
    })
}

module.exports.approveOrder = async (context) => {
  const check = await Check.getCheckForOrder(context.orderId)

  const now = new Date()

  check.set('flags.reciprocate-init-swap', {
    approve: now,
    message: 'test'
  })

  return check.save()
}

module.exports.initiate = async (context, request) => {
  const fromClient = getClient(context.from)
  const toClient = getClient(context.to)

  context.fromAddress = (await fromClient.wallet.getUnusedAddress()).address
  context.toAddress = (await toClient.wallet.getUnusedAddress()).address
  context.secret = await fromClient.swap.generateSecret(uuidv4())
  context.secretHash = sha256(context.secret)
  context.toBlock = await toClient.chain.getBlockHeight()

  const { defaultFee } = config.assets[context.from]

  const tx = await withLock(context.from, async () => {
    const fees = await fromClient.chain.getFees()

    return fromClient.swap.initiateSwap(
      {
        value: BN(context.fromAmount),
        recipientAddress: context.fromCounterPartyAddress,
        refundAddress: context.fromAddress,
        secretHash: context.secretHash,
        expiration: context.swapExpiration
      },
      fees[defaultFee].fee
    )
  })

  context.fromFundHash = tx.hash
}

module.exports.fund = async (context, request) => {
  const fromClient = getClient(context.from)
  const { defaultFee } = config.assets[context.from]

  const tx = await withLock(context.from, async () => {
    const fees = await fromClient.chain.getFees()

    return fromClient.swap.fundSwap(
      {
        value: BN(context.fromAmount),
        recipientAddress: context.fromCounterPartyAddress,
        refundAddress: context.fromAddress,
        secretHash: context.secretHash,
        expiration: context.swapExpiration
      },
      context.fromFundHash,
      fees[defaultFee].fee
    )
  })

  if (tx) {
    context.fromSecondaryFundHash = tx.hash
  }

  return module.exports.updateAgentOrder(context, request)
}

module.exports.updateAgentOrder = (context, request, isDuplicate = false) => {
  return request
    .post(`/api/swap/order/${context.orderId}`)
    .send({
      fromAddress: context.fromAddress,
      toAddress: context.toAddress,
      fromFundHash: context.fromFundHash,
      secretHash: context.secretHash,
      swapExpiration: context.swapExpiration,
      nodeSwapExpiration: context.nodeSwapExpiration
    })
    .then(res => {
      if (isDuplicate) {
        res.should.have.status(400)
        res.body.error.should.equal(`Duplicate order: ${context.orderId}`)
      } else {
        res.should.have.status(200)
        res.body.should.be.a('object')

        res.body.orderId.should.equal(context.orderId)
        res.body.from.should.equal(context.from)
        res.body.to.should.equal(context.to)
        res.body.fromAmount.should.equal(context.fromAmount)
        res.body.status.should.equal('USER_FUNDED_UNVERIFIED')

        Object.assign(context, res.body)
      }
    })
}

module.exports.verifyInitiate = async (context, request) => {
  const check = () => waitForRandom(1000, 1500).then(() => request
    .get(`/api/swap/order/${context.orderId}`)
    .then(res => {
      res.should.have.status(200)

      if (res.body.status === 'USER_FUNDED_UNVERIFIED') {
        return check()
      }

      // if agent funds immediately, status will be AGENT_CONTRACT_CREATED/AGENT_FUNDED instead of USER_FUNDED
      res.body.status.should.be.oneOf(['USER_FUNDED', 'AGENT_CONTRACT_CREATED', 'AGENT_FUNDED'])
    }))

  return check()
}

module.exports.verifyAgentFunding = async (context, request) => {
  const check = () => waitForRandom(1000, 1500).then(() => request
    .get(`/api/swap/order/${context.orderId}`)
    .then(res => {
      res.should.have.status(200)

      if (['USER_FUNDED', 'AGENT_CONTRACT_CREATED'].includes(res.body.status)) {
        return check()
      }

      res.body.status.should.equal('AGENT_FUNDED')
    }))

  return check()
}

module.exports.findAgentFundingTx = async context => {
  const toClient = getClient(context.to)

  const findInitSwapTx = async lastScannedBlock => {
    const currentBlock = await toClient.chain.getBlockHeight()
    const initSwapTx = await blockScanOrFind(toClient, async blockNumber => toClient.swap.findInitiateSwapTransaction(
      {
        value: BN(context.toAmount),
        recipientAddress: context.toAddress,
        refundAddress: context.toCounterPartyAddress,
        secretHash: context.secretHash,
        expiration: context.nodeSwapExpiration
      },
      blockNumber
    ), lastScannedBlock, currentBlock)

    if (initSwapTx) return initSwapTx

    return waitForRandom(1000, 1500).then(() => findInitSwapTx(currentBlock))
  }

  const tx = await findInitSwapTx(context.toBlock)
  context.toFundHash = tx.hash
}

module.exports.claim = async context => {
  const toClient = getClient(context.to)

  const { defaultFee } = config.assets[context.to]

  return withLock(context.to, async () => {
    const fees = await toClient.chain.getFees()

    return toClient.swap.claimSwap(
      {
        value: BN(context.toAmount),
        recipientAddress: context.toAddress,
        refundAddress: context.toCounterPartyAddress,
        secretHash: context.secretHash,
        expiration: context.nodeSwapExpiration
      },
      context.toFundHash,
      context.secret,
      fees[defaultFee].fee
    )
  })
}

module.exports.refundSwap = async context => {
  const fromClient = getClient(context.from)

  const { defaultFee } = config.assets[context.from]

  return withLock(context.from, async () => {
    const fees = await fromClient.chain.getFees()

    const { hash } = await fromClient.swap.refundSwap(
      {
        value: BN(context.fromAmount),
        recipientAddress: context.fromCounterPartyAddress,
        refundAddress: context.fromAddress,
        secretHash: context.secretHash,
        expiration: context.swapExpiration
      },
      context.fromFundHash,
      fees[defaultFee].fee
    )

    context.fromRefundHash = hash
  }).catch(e => {
    if (e.name === 'PossibleTimelockError') {
      console.log('[user] PossibleTimelockError')
      return wait(5000).then(() => module.exports.refundSwap(context))
    }

    throw e
  })
}

module.exports.verifyUserRefund = async (context, request) => {
  const check = () => waitForRandom(1000, 1500).then(() => request
    .get(`/api/swap/order/${context.orderId}`)
    .then(res => {
      res.should.have.status(200)

      if (!res.body.fromRefundHash) return check()

      expect(res.body.fromRefundHash).to.equal(context.fromRefundHash)
    }))

  return check()
}

module.exports.verifyAllTxs = async (context, request) => {
  const check = () => waitForRandom(1000, 1500).then(() => request
    .get(`/api/swap/order/${context.orderId}`)
    .then(res => {
      res.should.have.status(200)

      if (res.body.hasUnconfirmedTx) return check()

      expect(res.body.hasUnconfirmedTx).to.equal(false)
    }))

  return check()
}

module.exports.verifyClaimOrRefund = async (context, request, expectedStatus) => {
  const check = () => waitForRandom(1000, 1500).then(() => request
    .get(`/api/swap/order/${context.orderId}`)
    .then(res => {
      res.should.have.status(200)

      if (['AGENT_FUNDED', 'USER_CLAIMED'].includes(res.body.status)) {
        return check()
      }

      res.body.status.should.equal(expectedStatus)
    }))

  return check()
}

module.exports.deployAndMintMidman = async () => {
  const eth = getClient('ETH')

  const code = await eth.getMethod('getCode')(config.assets.DAI.contractAddress, 'latest')
  if (code) return debug('MIDMAN ERC-20 contract already exists')

  debug('Deploying MIDMAN ERC-20 contract')

  const tx = await eth.chain.sendTransaction(
    { to: null, value: 0, data: '0x60c0604052600660808190526526a4a226a0a760d11b60a09081526100279160039190610072565b506040805180820190915260038082526213525160ea1b602090920191825261005291600491610072565b506005805460ff1916601217905534801561006c57600080fd5b5061010d565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106100b357805160ff19168380011785556100e0565b828001600101855582156100e0579182015b828111156100e05782518255916020019190600101906100c5565b506100ec9291506100f0565b5090565b61010a91905b808211156100ec57600081556001016100f6565b90565b610b538061011c6000396000f3fe608060405234801561001057600080fd5b50600436106100b45760003560e01c806340c10f191161007157806340c10f191461021057806370a082311461023e57806395d89b4114610264578063a457c2d71461026c578063a9059cbb14610298578063dd62ed3e146102c4576100b4565b806306fdde03146100b9578063095ea7b31461013657806318160ddd1461017657806323b872dd14610190578063313ce567146101c657806339509351146101e4575b600080fd5b6100c16102f2565b6040805160208082528351818301528351919283929083019185019080838360005b838110156100fb5781810151838201526020016100e3565b50505050905090810190601f1680156101285780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6101626004803603604081101561014c57600080fd5b506001600160a01b038135169060200135610388565b604080519115158252519081900360200190f35b61017e6103a5565b60408051918252519081900360200190f35b610162600480360360608110156101a657600080fd5b506001600160a01b038135811691602081013590911690604001356103ab565b6101ce610438565b6040805160ff9092168252519081900360200190f35b610162600480360360408110156101fa57600080fd5b506001600160a01b038135169060200135610441565b61023c6004803603604081101561022657600080fd5b506001600160a01b038135169060200135610495565b005b61017e6004803603602081101561025457600080fd5b50356001600160a01b03166104a3565b6100c16104be565b6101626004803603604081101561028257600080fd5b506001600160a01b03813516906020013561051f565b610162600480360360408110156102ae57600080fd5b506001600160a01b03813516906020013561058d565b61017e600480360360408110156102da57600080fd5b506001600160a01b03813581169160200135166105a1565b60038054604080516020601f600260001961010060018816150201909516949094049384018190048102820181019092528281526060939092909183018282801561037e5780601f106103535761010080835404028352916020019161037e565b820191906000526020600020905b81548152906001019060200180831161036157829003601f168201915b5050505050905090565b600061039c6103956105cc565b84846105d0565b50600192915050565b60025490565b60006103b88484846106bc565b61042e846103c46105cc565b61042985604051806060016040528060288152602001610a88602891396001600160a01b038a166000908152600160205260408120906104026105cc565b6001600160a01b03168152602081019190915260400160002054919063ffffffff61082316565b6105d0565b5060019392505050565b60055460ff1690565b600061039c61044e6105cc565b84610429856001600061045f6105cc565b6001600160a01b03908116825260208083019390935260409182016000908120918c16815292529020549063ffffffff6108ba16565b61049f828261091b565b5050565b6001600160a01b031660009081526020819052604090205490565b60048054604080516020601f600260001961010060018816150201909516949094049384018190048102820181019092528281526060939092909183018282801561037e5780601f106103535761010080835404028352916020019161037e565b600061039c61052c6105cc565b8461042985604051806060016040528060258152602001610af960259139600160006105566105cc565b6001600160a01b03908116825260208083019390935260409182016000908120918d1681529252902054919063ffffffff61082316565b600061039c61059a6105cc565b84846106bc565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b3390565b6001600160a01b0383166106155760405162461bcd60e51b8152600401808060200182810382526024815260200180610ad56024913960400191505060405180910390fd5b6001600160a01b03821661065a5760405162461bcd60e51b8152600401808060200182810382526022815260200180610a406022913960400191505060405180910390fd5b6001600160a01b03808416600081815260016020908152604080832094871680845294825291829020859055815185815291517f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9259281900390910190a3505050565b6001600160a01b0383166107015760405162461bcd60e51b8152600401808060200182810382526025815260200180610ab06025913960400191505060405180910390fd5b6001600160a01b0382166107465760405162461bcd60e51b8152600401808060200182810382526023815260200180610a1d6023913960400191505060405180910390fd5b610751838383610a17565b61079481604051806060016040528060268152602001610a62602691396001600160a01b038616600090815260208190526040902054919063ffffffff61082316565b6001600160a01b0380851660009081526020819052604080822093909355908416815220546107c9908263ffffffff6108ba16565b6001600160a01b038084166000818152602081815260409182902094909455805185815290519193928716927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a3505050565b600081848411156108b25760405162461bcd60e51b81526004018080602001828103825283818151815260200191508051906020019080838360005b8381101561087757818101518382015260200161085f565b50505050905090810190601f1680156108a45780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b505050900390565b600082820183811015610914576040805162461bcd60e51b815260206004820152601b60248201527f536166654d6174683a206164646974696f6e206f766572666c6f770000000000604482015290519081900360640190fd5b9392505050565b6001600160a01b038216610976576040805162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015290519081900360640190fd5b61098260008383610a17565b600254610995908263ffffffff6108ba16565b6002556001600160a01b0382166000908152602081905260409020546109c1908263ffffffff6108ba16565b6001600160a01b0383166000818152602081815260408083209490945583518581529351929391927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35050565b50505056fe45524332303a207472616e7366657220746f20746865207a65726f206164647265737345524332303a20617070726f766520746f20746865207a65726f206164647265737345524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e636545524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e636545524332303a207472616e736665722066726f6d20746865207a65726f206164647265737345524332303a20617070726f76652066726f6d20746865207a65726f206164647265737345524332303a2064656372656173656420616c6c6f77616e63652062656c6f77207a65726fa26469706673582212209d04412a8766e6bfa22667b8c1457c767c4d231c93e3ebef7a054db806407a5164736f6c63430006000033' }
  )

  let txReceipt = null

  while (txReceipt === null) {
    txReceipt = await eth.getMethod('getTransactionReceipt')(tx.hash)
    await wait(5000)
  }

  debug('MIDMAN Contract Address', txReceipt.contractAddress)

  if (config.assets.DAI.contractAddress !== txReceipt.contractAddress) {
    throw new Error(`Deployed contract address doesn't match ${config.assets.DAI.contractAddress}`)
  }

  debug('Minting 1,000,000,000 MID tokens for agent')

  const mintAgentTx = await eth.chain.sendTransaction(
    {
      to: txReceipt.contractAddress,
      value: null,
      data: '0x40c10f19000000000000000000000000625ACaEdeF812d2842eFd2Fb0294682A868455bd0000000000000000000000000000000000000000033b2e3c9fd0803ce8000000'
    }
  )

  debug('MIDMAN minting for agent tx hash', mintAgentTx.hash)

  debug('Minting 1,000,000,000 MID tokens for wallet')

  const mintWalletTx = await eth.chain.sendTransaction(
    {
      to: txReceipt.contractAddress,
      value: null,
      data: '0x40c10f190000000000000000000000003dc584c132f6189dca45152ea889b9aac70db0c30000000000000000000000000000000000000000033b2e3c9fd0803ce8000000'
    }
  )

  debug('MIDMAN minting for wallet tx hash', mintWalletTx.hash)
}
