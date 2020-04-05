const debug = require('debug')('liquality:agent:worker:update-market-data')

const Asset = require('../../models/Asset')

module.exports = agenda => async job => {
  debug('Updating agent balance')

  const assets = await Asset.find({ status: 'ACTIVE' }).exec()

  await Promise.all(assets.map(async asset => {
    const client = asset.getClient()

    const addresses = await client.wallet.getUsedAddresses()
    const balance = await client.chain.getBalance(addresses)

    debug(asset.code, balance)

    asset.actualBalance = balance

    return asset.save()
  }))
}
