# 💥 Atomic Agent ![Build status](https://github.com/liquality/agent/workflows/Test,%20publish%20&%20deploy/badge.svg)


## Prerequisites

1. Linux VM
2. node 8
3. mongoDB 4.2+
4. [RPC/API endpoints for the chains you want to support](#liquality-nodes)


## Setup

```bash
git clone git@github.com:liquality/atomicagent.git
cd atomicagent
npm ci
cp sample.config.toml config.toml   # copy sample config
nano config.toml                    # configure your agent
nano src/migrate/data/assets.json   # add/remove assets
nano src/migrate/data/markets.json  # add/remove markets
npm run migrate                     # prepare agent with assets & markets
```


## Liquality Hosted Agents

|Environment| Network | Endpoint                                               |
|-|---------|--------------------------------------------------------|
|Production| Testnet | https://liquality.io/swap-testnet/agent                |
|Production| Mainnet | https://liquality.io/swap/agent                        |
|Development| Testnet | https://liquality.io/swap-testnet-dev/agent                |
|Development| Mainnet | https://liquality.io/swap-dev/agent                        |


## Liquality Nodes

| Node                  | Network | Endpoint                                               |
|-----------------------|---------|--------------------------------------------------------|
| Bitcoin Electrs       | Testnet | https://liquality.io/testnet/electrs                   |
| Bitcoin Electrs       | Mainnet | https://api-mainnet-bitcoin-electrs.liquality.io       |
| Bitcoin Batch Electrs | Testnet | https://liquality.io/electrs-testnet-batch             |
| Bitcoin Batch Electrs | Mainnet | https://api-mainnet-bitcoin-electrs-batch.liquality.io |
| Ethereum Scraper      | Testnet | https://liquality.io/eth-rinkeby-api                   |
| Ethereum Scraper      | Mainnet | https://liquality.io/eth-mainnet-api                   |
| RSK Scraper           | Testnet | https://liquality.io/rsk-testnet-api                   |
| RSK Scraper           | Mainnet | https://liquality.io/rsk-mainnet-api                   |
| BSC Scraper           | Testnet | https://liquality.io/bsc-testnet-api                   |
| BSC Scraper           | Mainnet | https://liquality.io/bsc-mainnet-api                   |


## Run!

```bash
npm run api     # runs agent market maker api
npm run worker  # runs the background process
```


## Test


### Configure

```bash
cp sample.config.toml test.config.toml  # copy sample config
nano config.toml                        # configure your agent as per your test environment
```


### Test!

```bash
chmod -R 777 test/docker/config
npm run docker:start
sleep 30                          # let bitcoind[regtest] mine first 100 blocks
npm run test
```


## License

[MIT](./LICENSE.md)
