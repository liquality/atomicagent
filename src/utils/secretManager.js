const Vault = require('node-vault')

const config = require('../config')

let vault

const vaultSecretProvider = async asset => {
  if (!vault) {
    vault = Vault({
      apiVersion: 'v1',
      endpoint: config.vault.endpoint
    })

    await vault.approleLogin({
      role_id: process.env.VAULT_ROLE_ID,
      secret_id: process.env.VAULT_SECRET_ID
    })
  }

  const { data: { mnemonic } } = await vault.read(`${config.vault.mnemonicsBasePath}/${asset}`)
  return mnemonic
}

const configSecretProvider = async asset => {
  return config.assets[asset].wallet.mnemonic
}

const getMnemonic = async asset => {
  if (config.vault && config.vault.endpoint) {
    return vaultSecretProvider(asset)
  }

  return configSecretProvider(asset)
}

module.exports = {
  getMnemonic
}
