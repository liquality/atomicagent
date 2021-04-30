const semver = require('semver')
const pkg = require('../../package.json')

const AGENT_CAL_VERSION = pkg.dependencies['@liquality/client'].replace('^', '').replace('~', '')
const USER_AGENT_REGEX = /Wallet (\d.*?\.\d.*?\.\d.*?) \(CAL (\d.*?\.\d.*?\.\d.*?)\)/

module.exports = (incompatibleResponse) => (req, res, next) => {
  const userAgent = req.get('X-Liquality-User-Agent')
  if (userAgent) {
    const matches = USER_AGENT_REGEX.exec(userAgent)
    if (matches) {
      const userCALVersion = matches[2]
      const isUserAgentCompatible = ['patch', null].includes(semver.diff(userCALVersion, AGENT_CAL_VERSION))
      if (!isUserAgentCompatible) return res.json(incompatibleResponse)
    }
  }

  next()
}
