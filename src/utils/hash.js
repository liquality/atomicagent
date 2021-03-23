module.exports.toLowerCaseWithout0x = hash => {
  if (typeof hash !== 'string') return hash

  hash = hash.toLowerCase()
  if (hash.startsWith('0x')) return hash.replace(/0x/g, '')
  return hash
}

module.exports.isValidTxHash = txHash => /^([A-Fa-f0-9]{64})$/.test(txHash)
module.exports.isValidSecretHash = module.exports.isValidTxHash
