/* eslint-env mocha */
const { swap, prepare, clear } = require('./utils')

describe('Agent', () => {
  before(async function () {
    this.timeout(10000)

    await prepare()
  })

  describe('BTC -> ETH', () => {
    describe('Successful swap', () => {
      before(() => clear())

      swap('BTC', 'ETH', 5000000)
    })

    describe('Unsuccessful swap', () => {
      before(() => clear())

      swap('BTC', 'ETH', 5000000, true)
    })
  })

  describe('ETH -> BTC', () => {
    describe('Successful swap', () => {
      before(() => clear())

      swap('ETH', 'BTC', 250000000000000000)
    })

    describe('Successful swap with user claiming late', () => {
      before(() => clear())

      swap('ETH', 'BTC', 250000000000000000, false, true)
    })

    describe('Unsuccessful swap', () => {
      before(() => clear())

      swap('ETH', 'BTC', 250000000000000000, true)
    })
  })
})
