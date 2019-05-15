require('bcoin/lib/net/common').USER_AGENT = '/bcoin:v1.0.2/LIQ:agent.liquality.io'
const bcoin = require('bcoin')

const tchain = new bcoin.Chain({
  memory: true,
  network: 'testnet'
})

const tmempool = new bcoin.Mempool({
  network: 'testnet',
  chain: tchain
})

const tpool = new bcoin.Pool({
  network: 'testnet',
  chain: tchain,
  mempool: tmempool,
  size: 100
})

setInterval(function () {
  console.log('Checking for daemons')
  tpool.peers.list.toArray().forEach(checkForLiqualityAgent)
}, 10000)

// matches LIQ:domain.com
function checkForLiqualityAgent (peer) {
  const m = peer.agent.match(/LIQ:(.*)/)
  if (m && m[1]) {
    console.log(`Found a Liquality daemon on ${m[1]}`)
  }
}

;(async function () {
  tpool.on('peer', peer => {
    console.log('new peer', peer.hostname())
  })

  await tchain.open()
  await tpool.open()
  await tpool.connect()

  tpool.startSync()
})()
