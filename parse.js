const qs = require('qs')
const BigNumber = require('bignumber.js')

const mul = (val, by) => BigNumber(val).multipliedBy(by).toNumber()

module.exports = link => {
  const query = qs.parse(link.substring(link.indexOf('#') + 1))

  if (!query.isPartyB) throw new Error('Invalid Counter Party Link')

  if (query.ccy1 === 'btc') query.ccy1v = mul(query.ccy1v, 1e8)
  if (query.ccy2 === 'btc') query.ccy2v = mul(query.ccy2v, 1e8)

  if (query.ccy1 === 'eth') query.ccy1v = mul(query.ccy1v, 1e18)
  if (query.ccy2 === 'eth') query.ccy2v = mul(query.ccy2v, 1e18)

  return query
}
