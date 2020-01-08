/* eslint-env mocha */
const swap = require('./swap')
const { prepare } = require('./utils')

describe('ETH -> BTC', () => {
  before(() => prepare())

  describe('Successful swap', () => {
    swap('ETH', 'BTC', 250000000000000000)
  })

  describe('Unsuccessful swap', () => {
    swap('ETH', 'BTC', 250000000000000000, true)
  })
})
