const semver = require('semver')
const Client = require('@liquality/client')

const AGENT_CAL_VERSION = Client.version
const USER_AGENT_REGEX = /Wallet (\d.*?\.\d.*?\.\d.*?) \(CAL (\d.*?\.\d.*?\.\d.*?)\)/

module.exports = (incompatibleResponse) => (req, res, next) => {
  const userAgent = req.get('X-Liquality-User-Agent')
  if (userAgent) {
    const matches = USER_AGENT_REGEX.exec(userAgent)
    if (matches) {
      const userCALVersion = matches[2]
      const isUserAgentCompatible = semver.diff(userCALVersion, AGENT_CAL_VERSION) === 'patch'
      if (!isUserAgentCompatible) return res.json(incompatibleResponse)
    }
  }

  next()
}
