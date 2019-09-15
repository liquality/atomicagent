const mongoose = require('mongoose')
const BN = require('bignumber.js')
const { sha256 } = require('@liquality/crypto')

const clients = require('../utils/clients')
const { currencies } = require('../utils/fx')
const web3 = require('../utils/web3')
const { toWei } = web3().utils

const LoanSchema = new mongoose.Schema({
  principal: {
    type: String,
    index: true
  },
  collateral: {
    type: String,
    index: true
  },
  principalAmount: {
    type: Number,
    index: true
  },
  minimumCollateralAmount: {
    type: Number,
    index: true
  },
  collateralAmount: {
    type: Number,
    index: true
  },
  refundableCollateralAmount: {
    type: Number,
    index: true
  },
  seizableCollateralAmount: {
    type: Number,
    index: true
  },
  rate: {
    type: Number,
    index: true
  },
  lenderPrincipalAddress: {
    type: String,
    index: true
  },
  borrowerPrincipalAddress: {
    type: String,
    index: true
  },
  arbiterPrincipalAddress: {
    type: String,
    index: true
  },
  lenderCollateralPublicKey: {
    type: String,
    index: true
  },
  borrowerCollateralPublicKey: {
    type: String,
    index: true
  },
  arbiterCollateralPublicKey: {
    type: String,
    index: true
  },
  collateralRefundableP2SHAddress: {
    type: String
  },
  collateralSeizableP2SHAddress: {
    type: String
  },
  minConf: {
    type: Number,
    index: true
  },
  orderExpiresAt: {
    type: Number,
    index: true
  },
  lenderSecretHashes: {
    type: Array,
    index: true
  },
  lenderSecrets: {
    type: Array,
    index: true
  },
  borrowerSecretHashes: {
    type: Array,
    index: true
  },
  loanRequestTxHash: {
    type: String,
    index: true
  },
  approveTxHash: {
    type: String,
    index: true
  },
  acceptTxHash: {
    type: String,
    index: true
  },
  requestLoanDuration: {
    type: String,
    index: true
  },
  approveExpiration: {
    type: Number,
    index: true
  },
  loanExpiration: {
    type: Number,
    index: true
  },
  liquidationExpiration: {
    type: Number,
    index: true
  },
  seizureExpiration: {
    type: Number,
    index: true
  },
  requestExpiresAt: {
    type: Number
  },
  requestCreatedAt: {
    type: Number
  },
  loanId: {
    type: Number
  },
  status: {
    type: String,
    enum: ['QUOTE', 'REQUESTING', 'AWAITING_COLLATERAL', 'APPROVING', 'APPROVED', 'CANCELLING', 'CANCELLED', 'ACCEPTING', 'ACCEPTED'],
    index: true
  }
})

LoanSchema.methods.principalClient = function () {
  return clients[currencies[this.principal].chain]
}

LoanSchema.methods.collateralClient = function () {
  return clients[this.collateral]
}

LoanSchema.methods.json = function () {
  const json = this.toJSON()
  json.id = json._id

  delete json._id
  delete json.__v
  // delete json.lenderSecrets // TODO Uncomment

  return json
}

LoanSchema.methods.setAgentAddresses = async function () {
  if (this.lenderPrincipalAddress) throw new Error('Address exists')

  const principalAddresses = await web3().currentProvider.getAddresses()
  const collateralAddresses = await this.collateralClient().wallet.getAddresses()

  this.lenderPrincipalAddress = principalAddresses[0]
  this.lenderCollateralPublicKey = collateralAddresses[0].publicKey.toString('hex')
}

LoanSchema.methods.setSecretHashes = async function (collateralAmount) {
  const collateralAmountInSats = BN(collateralAmount).times(currencies[this.collateral].multiplier).toNumber()

  const secretData = [
    toWei(this.principalAmount.toString(), currencies[this.principal].unit), // Principal Value
    this.principal, // Principal
    collateralAmountInSats, // Collateral Value
    this.collateral, // Collateral
    this.borrowerPrincipalAddress, // Borrower Principal Address
    this.lenderPrincipalAddress, // Lender Principal Address
    this.borrowerCollateralPublicKey, // Borrower Collateral PubKey
    this.lenderCollateralPublicKey, // Lender Collateral PubKey
    this.requestCreatedAt // Fund Id as number
  ]

  const secretMsg = secretData.join('')
  const secrets = await this.collateralClient().loan.secrets.generateSecrets(secretMsg, 4)
  const secretHashes = secrets.map(secret => sha256(secret))

  this.lenderSecrets = secrets
  this.lenderSecretHashes = secretHashes

  this.collateralAmount = collateralAmount
}

LoanSchema.static('fromLoanMarket', function (loanMarket, params, minimumCollateralAmount) {
  return new Loan({
    principal: params.principal,
    collateral: params.collateral,
    principalAmount: params.principalAmount,
    minimumCollateralAmount,
    minConf: loanMarket.minConf,
    requestLoanDuration: params.loanDuration,
    requestExpiresAt: Date.now() + loanMarket.requestExpiresIn,
    requestCreatedAt: Date.now(),
    status: 'QUOTE'
  })
})

const Loan = mongoose.model('Loan', LoanSchema)
module.exports = Loan
