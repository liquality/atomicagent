const { getClient } = require('../utils/clients')

async function main () {
  const client = getClient('BTC')

  const fees = await client.chain.getFees()

  console.log(fees)
  console.log(await client.swap.refundSwap(
    '1ee8484efa8f97dda7ee5d02d270e7caf6d02b9208c9216eb51036d2dbf5497e',
    'bc1qqt32lejpqacu2hmj7ra2ratss5ya2kxw0dvp76',
    'bc1qma5pkr2se270sr4c5c6zkc0wr20dzalgjulk4r',
    '5196e022e40955107d75f1a84dcdcfb4ebf40a7d5e75d470de96bdd142507c98',
    1603626051,
    fees.fast.fee
  ))
}

main()
