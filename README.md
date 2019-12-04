# 💥 Atomic Agent

> Atomic Swap Agent


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

## Test

### Configure

```bash
cp sample.config.toml test.config.toml
nano config.toml # configure your agent as per your test environment
```

### Test!

```bash
npm test
```
