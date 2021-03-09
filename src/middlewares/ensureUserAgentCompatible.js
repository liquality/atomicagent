const semver = require('semver')
const Client = require('@liquality/client')

const MIN_COMPATIBLE_CAL_VERSION = `~${Client.version}`
const USER_AGENT_REGEX = /Wallet (\d.*?\.\d.*?\.\d.*?) \(CAL (\d.*?\.\d.*?\.\d.*?)\)/

module.exports = (incompatibleResponse) => (req, res, next) => {
  const userAgent = req.get('X-Liquality-User-Agent')
  if (userAgent) {
    if (userAgent === 'wallet') return res.json(incompatibleResponse) // TODO: remove after old user agent not used anymore

    const matches = USER_AGENT_REGEX.exec(userAgent)
    if (matches) {
      const calVersion = matches[2]
      const isUserAgentCompatible = semver.satisfies(calVersion, MIN_COMPATIBLE_CAL_VERSION)
      if (!isUserAgentCompatible) return res.json(incompatibleResponse)
    }
  }

  next()
}
