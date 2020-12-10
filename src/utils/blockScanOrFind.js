module.exports = async function blockScanOrFind (client, fn, lastScannedBlock, currentBlock) {
  const newBlocksExist = !lastScannedBlock || (currentBlock > lastScannedBlock)
  const doesBlockScan = client.swap.doesBlockScan
  if (doesBlockScan && !newBlocksExist) return

  if (doesBlockScan) {
    let blockNumber = lastScannedBlock ? lastScannedBlock + 1 : currentBlock
    for (;blockNumber <= currentBlock; blockNumber++) {
      const claimTx = await fn(blockNumber)
      if (claimTx) return claimTx
    }
  } else {
    return fn()
  }
}
