if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const toml = require('toml')
const fs = require('fs')

if (!process.env.CONFIG_PATH) {
  throw new Error('Config file path must be specified at CONFIG_PATH environment variable.')
}

const configPath = process.env.CONFIG_PATH
const configRaw = fs.readFileSync(configPath)
const config = toml.parse(configRaw)

module.exports = config
