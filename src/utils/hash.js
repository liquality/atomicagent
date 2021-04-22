module.exports.toLowerCaseWithout0x = hash => hash.indexOf('_') === -1 ? hash.toLowerCase().replace(/0x/g, '') : hash
module.exports.isValidTxHash = txHash => txHash.indexOf('_') === -1 ? /^([A-Fa-f0-9]{64})$/.test(txHash) : txHash
module.exports.isValidSecretHash = module.exports.isValidTxHash
