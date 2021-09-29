## Start vault server

```
cp vault.config.sample.hcl vault.config.hcl
vault server -config vault.config.hcl
```


## Setup vault

```
# Export VAULT_ADDR for `vault` commands
export VAULT_ADDR=http://localhost:8200

# Initialise vault & note down unseal keys & initial root token
vault operator init

# Use any 3 unseal keys to unseal vault
vault operator unseal

# Export VAULT_TOKEN (initial root token) for authenticated `vault` commands
export VAULT_TOKEN=""

# Enable `kv` secrets engine at path `secret`
vault secrets enable -path secret kv

# Enable `approle` auth method
vault auth enable approle
```


## Setup role & policy for the agent

```
# Create read-only permission on secrets stored at 'secret/agent/mainnet/production/*'
vault policy write agent-mainnet-production -<<EOF
path "secret/agent/mainnet/production/*" {
  capabilities = [ "read" ]
}
EOF

# Create `approle` for the agent
vault write auth/approle/role/agent-mainnet-production \
  policies=agent-mainnet-production \
  secret_id_num_uses=0 \
  secret_id_ttl=0 \
  token_num_uses=0 \
  token_ttl=0 \
  token_max_ttl=0
```


## Get authentication parameters for the agent

```
# Get role-id for the agent
vault read auth/approle/role/agent-mainnet-production/role-id

# Get secret-id for the agent
vault write -f auth/approle/role/agent-mainnet-production/secret-id
```


## Set asset's mnemonic

```
vault write secret/agent/mainnet/production/<ASSET> mnemonic=-
# write your mnemonic, press enter and then ^D to save
```


## Update config.toml

```
...
[vault]
endpoint = "http://127.0.0.1:8200"
mnemonicsBasePath = "secret/agent/mainnet/production"
...
```

## Update environment variables

```
VAULT_ROLE_ID=<role-id> npm run api
VAULT_SECRET_ID=<secret-id> npm run worker
```
