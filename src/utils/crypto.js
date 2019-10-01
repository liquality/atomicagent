const crypto = require('crypto')

module.exports.hash = (passphrase) => {
  const salt = crypto
    .randomBytes(8)
    .toString('hex')
  const hash = crypto
    .createHmac('sha512', salt)
    .update(passphrase)
    .digest('hex')

  return {
    salt,
    hash
  }
}

module.exports.verify = (passphrase, salt, passphraseHash) => {
  const hash = crypto
    .createHmac('sha512', salt)
    .update(passphrase)
    .digest('hex')

  return hash === passphraseHash
}
