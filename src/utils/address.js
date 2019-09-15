if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const { checksumEncode } = require('@liquality/ethereum-utils')

function getEthSigner () {
  checkEnv()
  return checksumEncode(process.env.ETH_SIGNER)
}

function checkEnv () {
  if (process.env.NODE_ENV === 'test') {
    const fs = require('fs')
    const path = require('path')
    const env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8')
    process.env.ETH_SIGNER = env.match(/ETH_SIGNER=([0-9a-z])\w+/g).toString().replace('ETH_SIGNER=', '')
  }
}

module.exports = {
  getEthSigner
}
