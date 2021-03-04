function formatAddress (address) {
  return address === undefined || address === null ? address : address.replace('0x', '').toLowerCase()
}

function formatHash (hash) {
  return hash === undefined || hash === null ? hash : hash.replace('0x', '').toLowerCase()
}

module.exports = {
  formatAddress,
  formatHash
}