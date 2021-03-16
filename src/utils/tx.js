module.exports.lowerCaseWithout0x = hash => {
  if (typeof hash !== 'string') return hash

  hash = hash.toLowerCase()
  if (hash.startsWith('0x')) return hash.replace(/0x/g, '')
  return hash
}
