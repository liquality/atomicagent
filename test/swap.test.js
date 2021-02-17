/* eslint-env mocha */
const _ = require('lodash')

const swap = require('./swap')
const { prepare, clearJobs } = require('./utils')
const config = require('../src/config')

const NUM_CONCURRENT_SWAPS_PER_MARKET = 3

const AMOUNT = {
  BTC: () => _.random(...[0.03, 0.031].map(v => v * 1e8)),
  ETH: () => _.random(...[0.26, 0.27].map(v => v * 1e18)),
  DAI: () => _.random(...[5, 5.1].map(v => v * 1e18))
}

const SWAPS = Object.entries(AMOUNT).reduce((acc, [fromAsset, fromAmount]) => {
  Object.keys(AMOUNT).forEach(toAsset => {
    if (fromAsset === toAsset) return

    acc[`${fromAsset}-${toAsset}`] = new Array(NUM_CONCURRENT_SWAPS_PER_MARKET).fill(0).map(() => ({
      from: fromAsset,
      to: toAsset,
      fromAmount: fromAmount()
    }))
  })

  return acc
}, {})

const SWAPS_ARR = Object.entries(SWAPS).reduce((acc, [market, swaps]) => {
  acc.push(...swaps)
  return acc
}, [])

describe.only('Swap', () => {
  before(async function () {
    this.timeout(0)
    await prepare()
  })

  describe('Successful single swap', () => {
    Object.keys(SWAPS).forEach(market => {
      describe(market, () => {
        before(async function () {
          this.timeout(0)
          await clearJobs()

          config.application.swapExpirationDurationInSeconds = 70
          config.application.nodeSwapExpirationDurationInSeconds = 30
        })

        swap([SWAPS[market][0]], { refund: false, reject: false })
      })
    })
  })

  describe('Unsuccessful single swap', () => {
    Object.keys(SWAPS).forEach(market => {
      describe(market, () => {
        before(async function () {
          this.timeout(0)
          await clearJobs()

          config.application.swapExpirationDurationInSeconds = 70
          config.application.nodeSwapExpirationDurationInSeconds = 30
        })

        swap([SWAPS[market][0]], { refund: true, reject: false })
      })
    })
  })

  describe('Successful concurrent swaps', () => {
    before(async function () {
      this.timeout(0)
      await clearJobs()

      config.application.swapExpirationDurationInSeconds = 580
      config.application.nodeSwapExpirationDurationInSeconds = 380
    })

    swap(SWAPS_ARR, { refund: false, reject: false })
  })
})
