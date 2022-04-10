require('../../utils/sentry')
const mongo = require('../../utils/mongo')
const debug = require('debug')('liquality:agent:worker:update-market-data')
const Market = require('../../models/Market')

async function process(job) {
  debug('Running....', job.id)

  await Market.updateAllMarketData()

  return {
    next: [
      {
        name: 'UpdateMarketData'
      }
    ]
  }
}

module.exports = (job) => {
  return mongo
    .connect()
    .then(() => process(job))
    .finally(() => mongo.disconnect())
}
