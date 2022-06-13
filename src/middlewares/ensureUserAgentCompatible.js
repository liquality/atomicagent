const semver = require('semver')

const CAL_VERSION_CHECK = '>=1.0.2'
const USER_AGENT_REGEX = /Wallet (\d.*?\.\d.*?\.\d.*?) \(Chainify (\d.*?\.\d.*?\.\d.*?)\)/

module.exports = (incompatibleResponse) => (req, res, next) => {
  const userAgent = req.get('X-Liquality-User-Agent')
  if (userAgent) {
    const matches = USER_AGENT_REGEX.exec(userAgent)
    if (matches) {
      const userCALVersion = matches[2]
      const isUserAgentCompatible = semver.satisfies(userCALVersion, CAL_VERSION_CHECK)
      if (!isUserAgentCompatible) return res.json(incompatibleResponse)
    } else {
      return res.json(incompatibleResponse)
    }
  }

  next()
}
