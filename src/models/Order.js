const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')
const cryptoassets = require('@liquality/cryptoassets').default

const config = require('../config')
const AuditLog = require('./AuditLog')
const MarketHistory = require('./MarketHistory')

const { getClient } = require('../utils/clients')
const { withLock } = require('../utils/chainLock')
const crypto = require('../utils/crypto')
const { RescheduleError } = require('../utils/errors')
const { calculateToAmount, calculateUsdAmount, calculateFeeUsdAmount } = require('../utils/fx')
const blockScanOrFind = require('../utils/blockScanOrFind')

const OrderSchema = new mongoose.Schema({
  migrationVersion: {
    type: Number,
    index: true
  },
  orderId: {
    type: String,
    index: true,
    unique: true
  },
  userAgent: {
    type: String,
    index: true
  },
  from: {
    type: String,
    index: true
  },
  to: {
    type: String,
    index: true
  },
  fromAmount: {
    type: Number,
    index: true
  },
  toAmount: {
    type: Number,
    index: true
  },
  fromRateUsd: {
    type: Number
  },
  toRateUsd: {
    type: Number
  },
  fromSecondaryRateUsd: {
    type: Number
  },
  toSecondaryRateUsd: {
    type: Number
  },
  toUsdValue: { // deprecated
    type: Number
  },
  fromUsdValue: { // deprecated
    type: Number
  },
  fromAmountUsd: {
    type: Number
  },
  toAmountUsd: {
    type: Number
  },
  rate: {
    type: Number,
    index: true
  },
  minConf: {
    type: Number,
    index: true
  },
  expiresAt: {
    type: Number,
    index: true
  },
  fromCounterPartyAddress: {
    type: String,
    index: true
  },
  toCounterPartyAddress: {
    type: String,
    index: true
  },

  fromAddress: {
    type: String,
    index: true
  },
  toAddress: {
    type: String,
    index: true
  },

  fromFundHash: {
    type: String,
    index: true
  },
  fromSecondaryFundHash: {
    type: String,
    index: true
  },
  fromRefundHash: {
    type: String,
    index: true
  },
  fromClaimHash: {
    type: String,
    index: true
  },
  toFundHash: {
    type: String,
    index: true
  },
  toSecondaryFundHash: {
    type: String,
    index: true
  },
  toClaimHash: {
    type: String,
    index: true
  },
  toRefundHash: {
    type: String,
    index: true
  },
  secretHash: {
    type: String,
    index: true
  },
  secret: {
    type: String,
    index: true
  },
  swapExpiration: {
    type: Number,
    index: true
  },
  nodeSwapExpiration: {
    type: Number,
    index: true
  },

  txMap: {
    type: Object,
    default: {}
  },

  totalAgentFeeUsd: {
    type: Number
  },
  totalUserFeeUsd: {
    type: Number
  },
  totalFeeUsd: {
    type: Number
  },

  hasAgentUnconfirmedTx: {
    type: Boolean,
    default: true,
    index: true
  },
  hasUserUnconfirmedTx: {
    type: Boolean,
    default: true,
    index: true
  },
  hasUnconfirmedTx: {
    type: Boolean,
    default: true,
    index: true
  },

  passphraseHash: {
    type: String
  },
  passphraseSalt: {
    type: String
  },

  fromStartBlock: {
    type: Number
  },
  toStartBlock: {
    type: Number
  },

  status: {
    type: String,
    enum: [
      'QUOTE',
      'USER_FUNDED_UNVERIFIED', 'USER_FUNDED',
      'AGENT_FUNDED',
      'USER_CLAIMED',
      'AGENT_CLAIMED',
      'AGENT_REFUNDED',
      'QUOTE_EXPIRED',
      'SWAP_EXPIRED'
    ],
    index: true
  }
}, { timestamps: true })

OrderSchema.methods.fromClient = function () {
  return getClient(this.from)
}

OrderSchema.methods.toClient = function () {
  return getClient(this.to)
}

OrderSchema.methods.json = function () {
  const json = this.toJSON()

  json.id = json.orderId
  delete json._id
  delete json.__v

  return json
}

OrderSchema.methods.setPassphrase = function (passphrase) {
  if (this.passphraseHash) throw new Error('Passphrase already exists')

  const {
    salt,
    hash
  } = crypto.hash(passphrase)

  this.passphraseSalt = salt
  this.passphraseHash = hash
}

OrderSchema.methods.verifyPassphrase = function (passphrase) {
  if (!this.passphraseHash) throw new Error('Passphrase doesn\'t exists')

  return crypto.verify(passphrase, this.passphraseSalt, this.passphraseHash)
}

OrderSchema.methods.setAgentAddresses = async function () {
  if (this.fromCounterPartyAddress) throw new Error('Address exists')

  const fromAddresses = await this.fromClient().wallet.getUnusedAddress()
  const toAddresses = await this.toClient().wallet.getUnusedAddress()

  this.fromCounterPartyAddress = cryptoassets[this.from].formatAddress(fromAddresses.address)
  this.toCounterPartyAddress = cryptoassets[this.to].formatAddress(toAddresses.address)
}

OrderSchema.methods.setExpiration = async function () {
  const now = Math.ceil(Date.now() / 1000)

  this.swapExpiration = now + config.application.swapExpirationDurationInSeconds
  this.nodeSwapExpiration = now + config.application.nodeSwapExpirationDurationInSeconds
}

OrderSchema.methods.setUsdRates = async function () {
  const [fromRateUsd, toRateUsd] = await Promise.all([
    MarketHistory.getMostRecentRate(`${this.from}-USD`),
    MarketHistory.getMostRecentRate(`${this.to}-USD`)
  ])

  this.fromRateUsd = fromRateUsd
  this.toRateUsd = toRateUsd

  const fromType = cryptoassets[this.from].type
  const toType = cryptoassets[this.to].type
  let ethUsd

  if (fromType === 'erc20' || toType === 'erc20') {
    ethUsd = await MarketHistory.getMostRecentRate('ETH-USD')
  }

  if (fromType === 'erc20') {
    this.fromSecondaryRateUsd = ethUsd
  }

  if (toType === 'erc20') {
    this.toSecondaryRateUsd = ethUsd
  }

  this.fromAmountUsd = calculateUsdAmount(this.from, this.fromAmount, fromRateUsd)
  this.toAmountUsd = calculateUsdAmount(this.to, this.toAmount, toRateUsd)
}

OrderSchema.pre('save', function (next) {
  const txs = Object.values(this.txMap)

  const userTxs = txs.filter(
    ({ type }) => (type.startsWith('from') && !type.includes('Claim')) || (type.startsWith('to') && type.includes('Claim'))
  )

  const agentTxs = txs.filter(
    ({ type }) => (type.startsWith('to') && !type.includes('Claim')) || (type.startsWith('from') && type.includes('Claim'))
  )

  this.hasUserUnconfirmedTx = !userTxs.every(({ blockHash }) => blockHash)
  this.hasAgentUnconfirmedTx = !agentTxs.every(({ blockHash }) => blockHash)
  this.hasUnconfirmedTx = this.hasUserUnconfirmedTx || this.hasAgentUnconfirmedTx

  this.totalAgentFeeUsd = 0
  this.totalAgentFeeUsd += this.getFeeForTxType('toFundHash')
  this.totalAgentFeeUsd += this.getFeeForTxType('toSecondaryFundHash')
  this.totalAgentFeeUsd += this.getFeeForTxType('fromClaimHash')
  this.totalAgentFeeUsd += this.getFeeForTxType('toRefundHash')

  this.totalUserFeeUsd = 0
  this.totalUserFeeUsd += this.getFeeForTxType('fromFundHash')
  this.totalUserFeeUsd += this.getFeeForTxType('fromSecondaryFundHash')
  this.totalUserFeeUsd += this.getFeeForTxType('toClaimHash')
  this.totalUserFeeUsd += this.getFeeForTxType('fromRefundHash')

  this.totalFeeUsd = this.totalUserFeeUsd + this.totalAgentFeeUsd

  next()
})

OrderSchema.methods.getFeeForTxType = function (type) {
  const tx = this[type]

  if (tx && this.txMap) {
    const obj = this.txMap[tx]
    if (obj && obj.feeAmountUsd) return obj.feeAmountUsd
  }

  return 0
}

OrderSchema.methods.isQuoteExpired = function () {
  return Date.now() > this.expiresAt
}

OrderSchema.methods.isSwapExpired = function (fromCurrentBlock) {
  return fromCurrentBlock.timestamp >= this.swapExpiration
}

OrderSchema.methods.isNodeSwapExpired = function (toCurrentBlock) {
  return toCurrentBlock.timestamp >= this.nodeSwapExpiration
}

OrderSchema.methods.addTx = function (type, tx) {
  if (!type) throw new Error('Invalid type')
  if (!tx || !tx.hash) throw new Error('Invalid tx')

  let side = type.match(/^from|^to/)
  if (!side) throw new Error(`Invalid tx type: ${type}`)
  side = side[0]

  const asset = this[side]
  const key = `txMap.${tx.hash}`
  const value = { asset, type, hash: tx.hash }

  if (tx.fee || tx.feePrice) {
    value.feeAmount = tx.fee
    value.feePrice = tx.feePrice

    const { type } = cryptoassets[asset]
    const key = type === 'erc20' ? 'Secondary' : ''
    const chain = type === 'erc20' ? 'ETH' : asset
    value.feeAmountUsd = calculateFeeUsdAmount(chain, tx.fee, this[`${side}${key}RateUsd`]).toNumber()
  }

  if (tx.blockHash) {
    value.blockHash = tx.blockHash
    value.blockNumber = tx.blockNumber
  }

  if (tx.placeholder) {
    value.placeholder = true
  } else {
    this.set(type, tx.hash)
  }

  Object.values(this.txMap).forEach(t => {
    if (t.type === type && t.placeholder) {
      this.set(`txMap.${t.hash}`, undefined)
    }
  })

  this.set(key, value)
}

OrderSchema.methods.claimSwap = async function () {
  const fromClient = this.fromClient()
  const { defaultFee } = config.assets[this.from]

  return withLock(this.from, async () => {
    const fees = await fromClient.chain.getFees()

    return fromClient.swap.claimSwap(
      this.fromFundHash,
      this.fromCounterPartyAddress,
      this.fromAddress,
      this.secret,
      this.swapExpiration,
      fees[defaultFee].fee
    )
  })
}

OrderSchema.methods.refundSwap = async function () {
  const toClient = this.toClient()
  const { defaultFee } = config.assets[this.to]

  return withLock(this.from, async () => {
    const fees = await toClient.chain.getFees()

    const refundTx = await toClient.swap.refundSwap(
      this.toFundHash,
      this.toAddress,
      this.toCounterPartyAddress,
      this.secretHash,
      this.nodeSwapExpiration,
      fees[defaultFee].fee
    )

    return refundTx
  })
}

OrderSchema.methods.initiateSwap = async function () {
  const toClient = this.toClient()
  const { defaultFee } = config.assets[this.to]

  return withLock(this.to, async () => {
    const fees = await toClient.chain.getFees()

    return toClient.swap.initiateSwap(
      this.toAmount,
      this.toAddress,
      this.toCounterPartyAddress,
      this.secretHash,
      this.nodeSwapExpiration,
      fees[defaultFee].fee
    )
  })
}

OrderSchema.methods.verifyInitiateSwapTransaction = async function () {
  const fromClient = this.fromClient()

  try {
    const verified = await fromClient.swap.verifyInitiateSwapTransaction(
      this.fromFundHash,
      this.fromAmount,
      this.fromCounterPartyAddress,
      this.fromAddress,
      this.secretHash,
      this.swapExpiration
    )

    if (!verified) {
      throw new RescheduleError(`Reschedule ${this.orderId}: Transaction not found`, this.from)
    }
  } catch (e) {
    if (['TxNotFoundError', 'PendingTxError', 'RescheduleError'].includes(e.name)) {
      throw new RescheduleError(e.message, this.from)
    }

    throw e
  }
}

OrderSchema.methods.findFromFundSwapTransaction = async function () {
  const fromClient = this.fromClient()

  try {
    const fromSecondaryFundTx = await fromClient.swap.findFundSwapTransaction(
      this.fromFundHash,
      this.fromAmount,
      this.fromCounterPartyAddress,
      this.fromAddress,
      this.secretHash,
      this.swapExpiration
    )

    return fromSecondaryFundTx
  } catch (e) {
    if (['TxNotFoundError', 'PendingTxError'].includes(e.name)) {
      throw new RescheduleError(e.message, this.from)
    }

    throw e
  }
}

OrderSchema.methods.findToFundSwapTransaction = async function () {
  const toClient = this.toClient()

  try {
    const toSecondaryFundTx = await toClient.swap.findFundSwapTransaction(
      this.toFundHash,
      this.toAmount,
      this.toAddress,
      this.toCounterPartyAddress,
      this.secretHash,
      this.swapExpiration
    )

    return toSecondaryFundTx
  } catch (e) {
    if (['TxNotFoundError', 'PendingTxError'].includes(e.name)) {
      throw new RescheduleError(e.message, this.to)
    }

    throw e
  }
}

OrderSchema.methods.findRefundSwapTransaction = async function (fromLastScannedBlock, fromCurrentBlockNumber) {
  const fromClient = this.fromClient()

  if (!fromCurrentBlockNumber) {
    fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
  }

  return blockScanOrFind(fromClient, async blockNumber => {
    try {
      const tx = await fromClient.swap.findRefundSwapTransaction(
        this.fromFundHash,
        this.fromCounterPartyAddress,
        this.fromAddress,
        this.secretHash,
        this.swapExpiration,
        blockNumber
      )

      return tx
    } catch (e) {
      if (['PendingTxError', 'BlockNotFoundError'].includes(e.name)) {
        throw new RescheduleError(e.message, this.from)
      }

      throw e
    }
  }, fromLastScannedBlock, fromCurrentBlockNumber)
}

OrderSchema.methods.findToClaimSwapTransaction = async function (toLastScannedBlock, toCurrentBlockNumber) {
  const toClient = this.toClient()

  if (!toCurrentBlockNumber) {
    toCurrentBlockNumber = await toClient.chain.getBlockHeight()
  }

  return blockScanOrFind(toClient, async blockNumber => {
    try {
      const tx = await toClient.swap.findClaimSwapTransaction(
        this.toFundHash,
        this.toAddress,
        this.toCounterPartyAddress,
        this.secretHash,
        this.nodeSwapExpiration,
        blockNumber
      )

      return tx
    } catch (e) {
      if (['PendingTxError', 'BlockNotFoundError'].includes(e.name)) {
        throw new RescheduleError(e.message, this.to)
      }

      throw e
    }
  }, toLastScannedBlock, toCurrentBlockNumber)
}

OrderSchema.methods.log = async function (context, status, extra) {
  return AuditLog.create({
    orderId: this.orderId,
    orderStatus: this.status,
    context,
    status,
    extra
  })
}

OrderSchema.static('fromMarket', function (market, fromAmount) {
  return new Order({
    orderId: uuidv4(),
    fromAmount,
    toAmount: calculateToAmount(market.from, market.to, fromAmount, market.rate),
    from: market.from,
    to: market.to,
    rate: market.rate,
    minConf: market.minConf,

    expiresAt: Date.now() + market.orderExpiresIn,
    status: 'QUOTE'
  })
})

const Order = mongoose.model('Order', OrderSchema)
module.exports = Order
