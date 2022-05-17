const mongoose = require('mongoose')
const { omitBy } = require('lodash')
const { v4: uuidv4 } = require('uuid')
const { assets, chains } = require('@liquality/cryptoassets')
const config = require('../config')
const AuditLog = require('./AuditLog')
const MarketHistory = require('./MarketHistory')

const { getClient } = require('../utils/clients')
const { withRetry } = require('../utils/chainLock')
const { getChainifyAsset, requiresApproval, approve } = require('../utils/chainify')
const { formatTxHash } = require('../utils/hash')
const { RescheduleError } = require('../utils/errors')
const { calculateToAmount, calculateUsdAmount, calculateFeeUsdAmount } = require('../utils/fx')
const blockScanOrFind = require('../utils/blockScanOrFind')
const BN = require('bignumber.js')

const OrderSchema = new mongoose.Schema(
  {
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
    toUsdValue: {
      // deprecated
      type: Number
    },
    fromUsdValue: {
      // deprecated
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
    spread: {
      type: Number,
      index: true
    },
    minConf: {
      type: Number,
      index: true
    },

    // this is a value in seconds
    // TODO: rename to a proper key
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
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.from)
      }
    },
    fromSecondaryFundHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.from)
      }
    },
    fromRefundHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.from)
      }
    },
    fromClaimHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.from)
      }
    },
    toFundHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.to)
      }
    },
    toSecondaryFundHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.to)
      }
    },
    toClaimHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.to)
      }
    },
    toRefundHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return formatHash(hash, this.to)
      }
    },
    secretHash: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return hash.toLowerCase().replace(/0x/g, '')
      }
    },
    secret: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: false,
      set: function (hash) {
        return hash.toLowerCase().replace(/0x/g, '')
      }
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
        'USER_FUNDED_UNVERIFIED',
        'USER_FUNDED',
        'AGENT_APPROVED',
        'AGENT_FUNDED',
        'USER_CLAIMED',
        'AGENT_CLAIMED',
        'AGENT_REFUNDED',
        'QUOTE_EXPIRED',
        'SWAP_EXPIRED'
      ],
      index: true
    }
  },
  { timestamps: true }
)

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

  const fromChainNativeAsset = chains[assets[this.from].chain].nativeAsset
  const toChainNativeAsset = chains[assets[this.to].chain].nativeAsset

  if (fromChainNativeAsset !== this.from) {
    this.fromSecondaryRateUsd = await MarketHistory.getMostRecentRate(`${fromChainNativeAsset}-USD`)
  }

  if (toChainNativeAsset !== this.to) {
    this.toSecondaryRateUsd = await MarketHistory.getMostRecentRate(`${toChainNativeAsset}-USD`)
  }

  this.fromAmountUsd = calculateUsdAmount(this.from, this.fromAmount, fromRateUsd) || 0
  this.toAmountUsd = calculateUsdAmount(this.to, this.toAmount, toRateUsd) || 0
}

OrderSchema.pre('save', function (next) {
  const txs = Object.values(this.txMap)

  const agentTxs = txs.filter(
    ({ type }) =>
      (type.startsWith('to') && !type.includes('Claim')) || (type.startsWith('from') && type.includes('Claim'))
  )

  this.hasAgentUnconfirmedTx = !agentTxs.every(({ blockHash, replacedBy }) => blockHash || replacedBy)

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
  return Date.now() >= this.expiresAt
}

OrderSchema.methods.isSwapExpired = function (fromCurrentBlock) {
  return fromCurrentBlock.timestamp >= this.swapExpiration
}

OrderSchema.methods.isNodeSwapExpired = function (toCurrentBlock) {
  return toCurrentBlock.timestamp >= this.nodeSwapExpiration
}

OrderSchema.methods.addTx = function (type, tx) {
  if (!type) throw new Error('Invalid type')
  if (!tx || !(tx.placeholder || tx.hash)) throw new Error('Invalid tx')

  let side = type.match(/^from|^to/)
  if (!side) throw new Error(`Invalid tx type: ${type}`)
  side = side[0]

  const asset = this[side]
  const hash = tx.placeholder ? uuidv4() : formatTxHash(tx.hash, asset)
  const txMapItemValue = {
    asset,
    type,
    hash
  }

  if (tx.fee || tx.feePrice) {
    txMapItemValue.feeAmount = tx.fee
    txMapItemValue.feePrice = tx.feePrice

    const { type, chain } = assets[asset]
    const key = type === 'erc20' ? 'Secondary' : ''
    const nativeAsset = chains[chain].nativeAsset
    txMapItemValue.feeAmountUsd = calculateFeeUsdAmount(nativeAsset, tx.fee, this[`${side}${key}RateUsd`]) || 0
  }

  if (tx.blockHash) {
    txMapItemValue.blockHash = tx.blockHash
    txMapItemValue.blockNumber = tx.blockNumber

    // update existing tx:type entry with replacedBy key:val
    Object.entries(this.txMap).forEach(([key, value]) => {
      if (value.type === type && !value.replacedBy) {
        this.set(`txMap.${key}.replacedBy`, hash)
      }
    })
  }

  if (tx.placeholder) {
    txMapItemValue.placeholder = true
  } else {
    this.set(type, hash)
  }

  // remove existing placeholder tx with same type
  this.txMap = omitBy(this.txMap, (value) => value.type === type && value.placeholder)
  this.set(`txMap.${hash}`, txMapItemValue)
}

OrderSchema.methods.claimSwap = async function () {
  const fromClient = await this.fromClient()
  const { defaultFee } = config.assets[this.from]

  return withRetry(this.from, async () => {
    const fees = await fromClient.chain.getFees()

    return fromClient.swap.claimSwap(
      {
        asset: getChainifyAsset(assets[this.from]),
        value: BN(this.fromAmount),
        recipientAddress: this.fromCounterPartyAddress,
        refundAddress: this.fromAddress,
        secretHash: this.secretHash,
        expiration: this.swapExpiration
      },
      this.fromFundHash,
      this.secret,
      fees[defaultFee].fee
    )
  })
}

OrderSchema.methods.refundSwap = async function () {
  const toClient = await this.toClient()
  const { defaultFee } = config.assets[this.to]

  return withRetry(this.to, async () => {
    const fees = await toClient.chain.getFees()

    return toClient.swap.refundSwap(
      {
        asset: getChainifyAsset(assets[this.to]),
        value: BN(this.toAmount),
        recipientAddress: this.toAddress,
        refundAddress: this.toCounterPartyAddress,
        secretHash: this.secretHash,
        expiration: this.nodeSwapExpiration
      },
      this.toFundHash,
      fees[defaultFee].fee
    )
  })
}

OrderSchema.methods.initiateSwap = async function () {
  const toClient = await this.toClient()
  const { defaultFee } = config.assets[this.to]

  return withRetry(this.to, async () => {
    const fees = await toClient.chain.getFees()

    return toClient.swap.initiateSwap(
      {
        asset: getChainifyAsset(assets[this.to]),
        value: BN(this.toAmount),
        recipientAddress: this.toAddress,
        refundAddress: this.toCounterPartyAddress,
        secretHash: this.secretHash,
        expiration: this.nodeSwapExpiration
      },
      fees[defaultFee].fee
    )
  })
}

OrderSchema.methods.approveSwap = async function () {
  const toClient = await this.toClient()
  const approvalNeeded = await requiresApproval(toClient, this.to, this.toCounterPartyAddress, this.toAmount)

  if (approvalNeeded) {
    return withRetry(this.to, async () => {
      const fees = await toClient.chain.getFees()
      const { defaultFee } = config.assets[this.to]
      return approve(toClient, this.to, fees[defaultFee].fee)
    })
  }

  return null
}

OrderSchema.methods.verifyInitiateSwapTransaction = async function () {
  const fromClient = await this.fromClient()

  return withRetry(this.from, async () => {
    const verified = await fromClient.swap.verifyInitiateSwapTransaction(
      {
        asset: getChainifyAsset(assets[this.from]),
        value: BN(this.fromAmount),
        recipientAddress: this.fromCounterPartyAddress,
        refundAddress: this.fromAddress,
        secretHash: this.secretHash,
        expiration: this.swapExpiration
      },
      this.fromFundHash
    )

    if (!verified) {
      throw new RescheduleError(`Reschedule ${this.orderId}: Transaction not found`, this.from)
    }
  })
}

OrderSchema.methods.findToClaimSwapTransaction = async function (toLastScannedBlock, toCurrentBlockNumber) {
  const toClient = await this.toClient()

  if (!toCurrentBlockNumber) {
    toCurrentBlockNumber = await toClient.chain.getBlockHeight()
  }

  return blockScanOrFind(
    toClient,
    async (blockNumber) => {
      return withRetry(this.to, async () => {
        return toClient.swap.findClaimSwapTransaction(
          {
            asset: getChainifyAsset(assets[this.to]),
            value: BN(this.toAmount),
            recipientAddress: this.toAddress,
            refundAddress: this.toCounterPartyAddress,
            secretHash: this.secretHash,
            expiration: this.nodeSwapExpiration
          },
          this.toFundHash,
          blockNumber
        )
      })
    },
    toLastScannedBlock,
    toCurrentBlockNumber
  )
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
    spread: market.spread,
    minConf: market.minConf,

    expiresAt: Date.now() + config.application.quoteExpirationInSeconds * 1000,
    status: 'QUOTE'
  })
})

function formatHash(hash, asset) {
  // when querying documents, to/from are not set
  if (!asset) return hash
  return chains[assets[asset].chain].formatTransactionHash(hash)
}

const Order = mongoose.model('Order', OrderSchema)
module.exports = Order
