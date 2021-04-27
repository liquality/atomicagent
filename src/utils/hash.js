const { chains, assets } = require('@liquality/cryptoassets')
module.exports.formatTxHash = function (hash, asset) {
  if (!assets[asset]) {
    return false
  }
  return chains[assets[asset].chain].formatTransactionHash(hash)
}
module.exports.isValidTxHash = function (hash, asset) {
  if (!assets[asset]) {
    return false
  }
  return chains[assets[asset].chain].isValidTransactionHash(hash)
}

module.exports.isValidSecretHash = secretHash => /^([A-Fa-f0-9]{64})$/.test(secretHash)
