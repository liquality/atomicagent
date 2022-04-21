const { timingSafeEqual } = require('crypto')

module.exports.safeCompare = (a, b) => {
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}
