const { assets: ASSETS, testnetAssets } = require('@liquality/cryptoassets')

let assets = ASSETS

if (process.env.NODE_ENV === 'testnet') {
  assets = testnetAssets
} else if (process.env.NODE_ENV === 'test') {
  assets = {
    ...testnetAssets,
    DAI: {
      ...testnetAssets.DAI,
      contractAddress: '0x429c7f7c9C90703E319d94BdB2b93b56D7fE1b37'
    }
  }
}

module.exports = { assets }
