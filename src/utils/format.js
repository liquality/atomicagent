function formatAddress (address) {
  return address.replace('0x', '').toLowerCase()
}

function formatHash (hash) {
  return hash.replace('0x', '').toLowerCase()
}

module.exports = {
  formatAddress,
  formatHash
}