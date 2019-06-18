const qs = require('qs')
const { sha256 } = require('@liquality/crypto')

const BigNumber = require('bignumber.js')

const mul = (val, by) => BigNumber(val).multipliedBy(by).toNumber()

module.exports = async (emitter, client, data) => {
  let {
    id,

    ccy1,
    ccy1Addr,
    ccy1CounterPartyAddr,

    ccy2,
    ccy2Addr,
    ccy2CounterPartyAddr
  } = data

  let ccy1v = 0.01
  let ccy2v = 0.01

  const queryString = {
    ccy1,
    ccy2,

    ccy1Addr,
    ccy2Addr,

    ccy1CounterPartyAddr,
    ccy2CounterPartyAddr,

    isPartyB: true,
    ccy1v,
    ccy2v
  }

  if (ccy1 === 'btc') ccy1v = mul(ccy1v, 1e8)
  if (ccy2 === 'btc') ccy2v = mul(ccy2v, 1e8)

  if (ccy1 === 'eth') ccy1v = mul(ccy1v, 1e18)
  if (ccy2 === 'eth') ccy2v = mul(ccy2v, 1e18)

  const userExp = Math.ceil(Date.now() / 1000) + (60 * 60 * 12)
  const nodeExp = userExp - (60 * 60 * 6)

  const secret = await client[ccy2].swap.generateSecret('combak')
  const secretHash = sha256(secret)

  const tx = await client[ccy2].swap.initiateSwap(ccy2v, ccy2Addr, ccy2CounterPartyAddr, secretHash, userExp)
  console.log(`Initiated ${ccy2} to ${ccy1} swap`, tx)

  queryString.bFundHash = tx
  queryString.secretHash = secretHash
  queryString.expiration = userExp

  emitter.emit('init:link', {
    id,
    link: qs.stringify(queryString)
  })

  const cpHash = await client[ccy1].swap.findInitiateSwapTransaction(ccy1v, ccy1CounterPartyAddr, ccy1Addr, secretHash, nodeExp)
  const claimTx = await client[ccy1].swap.claimSwap(cpHash.hash, ccy1CounterPartyAddr, ccy1Addr, secret, nodeExp)

  console.log(`Node has claimed ${ccy1}: ${claimTx}`)

  emitter.emit('init:done', {
    id
  })
}
