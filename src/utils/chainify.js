const { remove0x } = require('@chainify/utils')
const { assets } = require('./cryptoassets')
const BN = require('bignumber.js')

const HTLC_ADDRESS = '133713376F69C1A67d7f3594583349DFB53d8166'

const getChainifyAsset = (asset) => {
  if (asset.type === 'native') {
    return { ...asset, isNative: true }
  } else {
    return { ...asset, isNative: false, contractAddress: asset.contractAddress?.toLowerCase() }
  }
}

const requiresApproval = async (client, asset, user, amount) => {
  const toAsset = assets[asset]

  // approve is needed only for ERC20 tokens
  if (!toAsset.contractAddress) {
    return false
  }

  const allowanceCallData = [
    '0xdd62ed3e', // signature
    `000000000000000000000000${remove0x(user)}`, // user address
    `000000000000000000000000${HTLC_ADDRESS}` // htlc address
  ].join('')

  const allowance = await client.chain.getProvider().call({
    data: allowanceCallData,
    to: toAsset.contractAddress
  })

  if (new BN(allowance.toString()).gte(amount.toString())) {
    return false
  }

  return true
}

const approve = async (client, asset, fee) => {
  const toAsset = assets[asset]

  // approve is needed only for ERC20 tokens
  if (!toAsset.contractAddress) {
    return null
  }

  const approveTxData = [
    '0x095ea7b3', // signature
    `000000000000000000000000${remove0x(HTLC_ADDRESS)}`, // htlc address
    `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` // max uint256
  ].join('')

  return client.wallet.sendTransaction({
    data: approveTxData,
    to: toAsset.contractAddress,
    fee
  })
}

module.exports = { getChainifyAsset, requiresApproval, approve, HTLC_ADDRESS }
