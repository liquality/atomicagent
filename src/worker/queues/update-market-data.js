require('../../utils/sentry')
const mongo = require('../../utils/mongo')
const debug = require('debug')('liquality:agent:worker:update-market-data')
const Market = require('../../models/Market')

const reportError = require('../../utils/reportError')

async function process(job) {
  debug('Running....', job.id)

  try {
    await Market.updateAllMarketData()
  } catch (err) {
    debug('error in updateMarketData', err.message)
    reportError(err, {}, { job })
  }
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
