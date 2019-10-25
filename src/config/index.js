if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const toml = require('toml')
const fs = require('fs')

if (!process.env.CONFIG_PATH) {
  console.log('Config file must be specified.')
  process.exit()
}

const configPath = process.env.CONFIG_PATH
const configRaw = fs.readFileSync(configPath)
const config = toml.parse(configRaw)

module.exports = config
