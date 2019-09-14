module.exports = async (emitter, client, data) => {
  const {
    id,
    ccy1,
    ccy1v,
    ccy2,
    ccy1Addr,
    ccy1CounterPartyAddr,
    bFundHash,
    ccy2v,
    ccy2Addr,
    ccy2CounterPartyAddr,
    secretHash,
    expiration
  } = data

  const nodeExp = expiration - (60 * 60 * 6)

  await client[ccy2].swap.verifyInitiateSwapTransaction(bFundHash, ccy2v, ccy2Addr, ccy2CounterPartyAddr, secretHash, expiration)
  console.log(`Found & verified ${ccy2} funding transaction`)

  const tx = await client[ccy1].swap.initiateSwap(ccy1v, ccy1CounterPartyAddr, ccy1Addr, secretHash, nodeExp)
  console.log(`Initiated ${ccy1} funding transaction`, tx)

  emitter.emit('swap:reciprocated', {
    id,
    aFundHash: tx
  })

  client[ccy1].swap.findClaimSwapTransaction(tx, ccy1CounterPartyAddr, ccy1Addr, secretHash, nodeExp).then(async tx => {
    const { secret } = tx
    console.log('Node has found user\'s claim transaction with secret', secret)

    const claimTx = await client[ccy2].swap.claimSwap(bFundHash, ccy2Addr, ccy2CounterPartyAddr, secret, expiration)

    emitter.emit('swap:done', {
      id,
      bClaimHash: claimTx
    })

    console.log(`Node has successfully claimed ${ccy2}!`)
  })
}
