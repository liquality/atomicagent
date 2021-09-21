# 💥 Atomic Agent ![Build status](https://github.com/liquality/agent/workflows/Test,%20publish%20&%20deploy/badge.svg)


## Table of Contents

* [Introduction][section-introduction]
* [Prerequisites][section-prerequisites]
* [Installation][section-installation]
* [Test][section-test]
* [Liquality Hosted Agents][section-liquality-hosted-agents]
* [Liquality Nodes][section-liquality-nodes]
* [Docker Setup Variations][section-docker-setup-variations]
* [User to Agent Swap Workflow][section-swap-workflow]
* [License][section-license]


## Introduction

The atomicagent service contains three utilities: `migrate`, `api`, `worker`. Each can be run separately, or as a full service.


## Prerequisites

1. Linux VM
2. node 14
3. mongoDB 4.2+
4. [RPC/API endpoints for the chains you want to support](#liquality-nodes)


## Installation

These instructions outline the standard installation process for the atomic agent:

```bash
git clone git@github.com:liquality/atomicagent.git
cd atomicagent
npm install
cp sample.config.toml config.toml   # copy sample config
nano config.toml                    # configure your agent settings
nano src/migrate/data/assets.json   # add/remove assets
nano src/migrate/data/markets.json  # add/remove markets
npm run migrate                     # prepare agent with assets & markets
```

### Run Each Utility Separately

```bash
npm run api     # runs agent market maker api
npm run worker  # runs the background process
```

### Run as a Unified Service

``` bash
npm run api-service
```

> These methods utilize the `config.toml` you created at the root of the repo.

> For Docker options, see: [Docker Setup Variations](#docker-setup-variations)


## Test

### Configure

```bash
cp sample.config.toml test.config.toml  # copy sample config
nano config.toml                        # configure your agent as per your test environment
```

### Run Automated Tests

```bash
chmod -R 777 test/docker/config
npm run docker:start
sleep 30                          # let bitcoind[regtest] mine first 100 blocks
npm run test
```


## Liquality Hosted Agents

|Environment | Network | Endpoint                                    |
|------------|---------|---------------------------------------------|
|Production  | Testnet | https://liquality.io/swap-testnet/agent     |
|Production  | Mainnet | https://liquality.io/swap/agent             |
|Development | Testnet | https://liquality.io/swap-testnet-dev/agent |
|Development | Mainnet | https://liquality.io/swap-dev/agent         |


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


## Docker Setup Variations

The atomicagent service (which contains three utilities: migrate, api, worker) can be dockerized for portability and convenience.

### Run the Atomic Agent Service Locally

To run the service (all three utilities) as a single container locally:

| Command               | Description                           |
| --------------------- | ------------------------------------- |
| `docker:build-local`  | Builds the "atomicagent-local" image. |
| `docker:run-local`    | Runs the "atomicagent-local" image as a container. |
| `docker:log-local`    | Prints the standard out of the running "atomicagent-local" container. |
| `docker:stop-local`   | Stops the running "atomicagent-local" container. |

The config file used for these commands: `env/local/config.local.toml`

> **NOTE:** This configuration requires you to have your own MongoDB running.

> **TIP:** You can use the `env/local/run-mongodb.yml` config to run a simple MongoDB locally.

### Run the Full Swap System

The atomicagent service operates on multiple dependencies (for various chains/networks), as well as requiring a MongoDB to read/write data.

To run the full swap system in a contained environment (for testing purposes):

| Command                     | Description                           |
| --------------------------- | ------------------------------------- |
| `docker:start-full-system`  | Builds and runs the "atomicagent-full-system" image and runs a local simulation of the supported agent services. |
| `docker:log-full-system`    | Prints the standard out of the running "atomicagent-full-system" container. |
| `docker:stop-full-system`   | Stops the running "atomicagent-full-system" container and the agent services. |

The config file used for these commands: `env/tester/config.tester.toml`


## User to Agent Swap Workflow

![Workflow](diagram.png "Workflow")


## License

[MIT](./LICENSE.md)



[section-introduction]: #introduction
[section-prerequisites]: #prerequisites
[section-installation]: #installation
[section-test]: #test
[section-liquality-hosted-agents]: #liquality-hosted-agents
[section-liquality-nodes]: #liquality-nodes
[section-docker-setup-variations]: #docker-setup-variations
[section-swap-workflow]: #user-to-agent-swap-workflow
[section-license]: #license
