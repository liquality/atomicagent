module.exports.toLowerCaseWithout0x = hash => hash.toLowerCase().replace(/0x/g, '')
module.exports.isValidTxHash = txHash => /^([A-Fa-f0-9]{64})$/.test(txHash)
module.exports.isValidSecretHash = module.exports.isValidTxHash
