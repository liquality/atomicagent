const semver = require('semver')

const MIN_COMPATIBLE_CAL_VERSION = '0.8.11'
const USER_AGENT_REGEX = /Wallet (\d.*?\.\d.*?\.\d.*?) \(CAL (\d.*?\.\d.*?\.\d.*?)\)/

module.exports = (incompatibleResponse) => (req, res, next) => {
  const userAgent = req.get('X-Liquality-User-Agent')
  if (userAgent) {
    if (userAgent === 'wallet') return res.json(incompatibleResponse) // TODO: remove after old user agent not used anymore

    const matches = USER_AGENT_REGEX.exec(userAgent)
    if (matches) {
      const calVersion = matches[2]
      const isUserAgentCompatible = semver.gte(calVersion, MIN_COMPATIBLE_CAL_VERSION)
      if (!isUserAgentCompatible) return res.json(incompatibleResponse)
    }
  }

  next()
}
