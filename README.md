# 💥 Atomic Agent ![Build status](https://github.com/liquality/agent/workflows/Test,%20publish%20&%20deploy/badge.svg)

> Atomic Swap Agent

## Setup

Follow these steps to setup your local environment: https://github.com/liquality/documentation/blob/dev/_posts/2019-11-13-installation.md#prerequisites

## Demo

Follow these steps to get started with your atomic agent locally!

### Configure

```bash
cp sample.config.toml config.toml
nano config.toml # configure your agent as per your environment
```

### Add test data

```bash
npm run migrate
```

### Run!

```bash
npm run api
npm run worker # in a separate shell
```
## Test!

```bash
# Remove old bitcoin data folder if it exists
# rm -rf test/docker/config/regtest
cp sample.config.toml test.config.toml
chmod -R 777 test/docker/config
npm run docker:start
npm test
```

## License

[MIT](./LICENSE.md)
