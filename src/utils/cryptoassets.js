const { assets: ASSETS, testnetAssets } = require('@liquality/cryptoassets')

let assets = ASSETS

if (process.env.NODE_ENV === 'testnet') {
  assets = testnetAssets
}

module.exports = { assets }
