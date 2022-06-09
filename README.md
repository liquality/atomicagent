# 💥 Atomic Agent ![Build status](https://github.com/liquality/agent/workflows/Test,%20publish%20&%20deploy/badge.svg)

## User <-> Agent Swap Workflow

![Workflow](diagram.png "Workflow")


## Prerequisites

1. Linux VM
2. node 14
3. mongoDB 4.2+
4. Redis 5
4. [RPC/API endpoints for the chains you want to support](#liquality-nodes)


## `bin/atomicagent` commands

```
Usage: atomicagent [options] [command]

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  wallet          Communicate with asset wallets
  manage          Manage assets & markets
  help [command]  display help for command
```


```
Usage: bin/atomicagent wallet [options] [command]

Options:
  -c, --config <path>                       Config file path
  -h, --help                                display help for command

Commands:
  balances
  balance <asset>
  getnewaddress <asset>
  sendtoaddress <asset> <address> <amount>
  help [command]                            display help for command
```


```
Usage: bin/atomicagent manage [options] [command]

Options:
  -c, --config <path>                                     Config file path
  -h, --help                                              display help for command

Commands:
  asset:add <code> <min> <max> <minConf> <dailyUsdLimit>
  asset:set <code> <key> <value>
  asset:disable <code>
  asset:enable <code>
  markets:create
  market:spread:set <from> <to> <spread>
  market:spread:get <from> <to>
  help [command]                                          display help for command
```


## Setup

### Prepare config.toml

```bash
git clone git@github.com:liquality/atomicagent.git
cd atomicagent
npm ci
cp sample.config.toml config.toml   # copy sample config
nano config.toml                    # configure your agent
```


### Prepare assets & markets

```
bin/atomicagent manage asset:add <code1> <min> <max> <minConf> <dailyUsdLimit>
bin/atomicagent manage asset:add <code2> <min> <max> <minConf> <dailyUsdLimit>
bin/atomicagent manage markets:create # creates market for code1-code2 & code2-code1
```


### Start the agent

```
npm start
```


## Liquality Hosted Agents

|Environment| Network | Endpoint                                               |
|-|---------|--------------------------------------------------------|
|Production| Testnet | https://liquality.io/swap-testnet/agent                |
|Production| Mainnet | https://liquality.io/swap/agent                        |
|Development| Testnet | https://liquality.io/swap-testnet-dev/agent                |
|Development| Mainnet | https://liquality.io/swap-dev/agent                        |


## Liquality Testnet Nodes

| Node                  | Network | Endpoint                                               |
|-----------------------|---------|--------------------------------------------------------|
| Bitcoin Electrs       | Testnet | https://liquality.io/testnet/electrs                   |
| Bitcoin Batch Electrs | Testnet | https://liquality.io/electrs-testnet-batch             |
| Ethereum Scraper      | Testnet | https://liquality.io/eth-ropsten-api                   |
| RSK Scraper           | Testnet | https://liquality.io/rsk-testnet-api                   |
| BSC Scraper           | Testnet | https://liquality.io/bsc-testnet-api                   |
| Polygon Scraper       | Testnet | https://liquality.io/polygon-testnet-api/              |


## Liquality Mainnet Nodes

| Node                  | Network | Endpoint                                               |
|-----------------------|---------|--------------------------------------------------------|
| Bitcoin Electrs       | Mainnet | https://api-mainnet-bitcoin-electrs.liquality.io       |
| Bitcoin Batch Electrs | Mainnet | https://api-mainnet-bitcoin-electrs-batch.liquality.io |
| Ethereum Scraper      | Mainnet | https://liquality.io/eth-mainnet-api                   |
| RSK Scraper           | Mainnet | https://liquality.io/rsk-mainnet-api                   |
| BSC Scraper           | Mainnet | https://liquality.io/bsc-mainnet-api                   |
| Polygon Scraper       | Mainnet | https://liquality.io/polygon-mainnet-api/              |


## Test


### Configure

```bash
cp sample.config.toml test.config.toml  # copy sample config to test config
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
