const fs = require('fs')
const path = require('path')
const toml = require('toml')

if (!process.env.CONFIG_PATH) {
  process.env.CONFIG_PATH = path.resolve(__dirname, '..', 'config/config.toml')
}

console.log(`Config file: ${process.env.CONFIG_PATH}`)

const configRaw = fs.readFileSync(process.env.CONFIG_PATH)
const config = toml.parse(configRaw)

module.exports = config
