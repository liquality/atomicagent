/* eslint-env mocha */
const swap = require('./swap')
const { prepare } = require('./utils')

describe.only('BTC -> ETH', () => {
  before(() => prepare())

  describe('Successful swap', () => {
    swap('BTC', 'ETH', 5000000)
  })

  describe('Unsuccessful swap', () => {
    swap('BTC', 'ETH', 5000000, true)
  })
})
