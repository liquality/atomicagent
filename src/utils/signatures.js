const ethJsUtil = require('ethereumjs-util')
const { ensure0x, checksumEncode } = require('@liquality/ethereum-utils')

function verifySignature (signature, message, address) {
  const msgBuffer = ethJsUtil.toBuffer(message)
  const msgHash = ethJsUtil.hashPersonalMessage(msgBuffer)
  const signatureBuffer = ethJsUtil.toBuffer(ensure0x(signature))
  const signatureParams = ethJsUtil.fromRpcSig(signatureBuffer)
  const publicKey = ethJsUtil.ecrecover(
    msgHash,
    signatureParams.v,
    signatureParams.r,
    signatureParams.s
  )
  const addressBuffer = ethJsUtil.publicToAddress(publicKey)
  const addressFromSignature = ethJsUtil.bufferToHex(addressBuffer)

  return checksumEncode(address) === checksumEncode(addressFromSignature)
}

module.exports = {
  verifySignature
}
