require('bcoin/lib/net/common').USER_AGENT = '/bcoin:v1.0.2(aHR0cDovL2xvY2FsaG9zdDo5MDkw)/'
const axios = require('axios')
const bcoin = require('bcoin').set('testnet')

const chain = new bcoin.Chain({
  memory: true,
  spv: true
})

const mempool = new bcoin.Mempool({ chain })

const tpool = new bcoin.Pool({ chain, mempool, size: 100 })

;(async function () {
  await chain.open()
  await tpool.open()
  await tpool.connect()

  tpool.on('peer', peer => {
    peer.on('connect', () => {
      console.log('connnected to peer')
      // setTimeout(function () {
      // peer.sendGetAddr()
      // }, 2000)
    })

    peer.on('packet', (msg) => {
      console.log(msg.cmd, msg.items.length)
      if (msg.cmd === 'addr') {
        msg.items.map(p => {
          if (p.isIPv4()) {
            const ip = p.split(':')[0]
            const port = 18883
            const rpc = [ ip, port ].join(':') + '/'

            console.log('Checking', rpc)
            axios.post(rpc).then(() => {
              console.log('Found one rpc')
            }).catch((e) => {
              console.error(e.message)
            })
          }
        })
      }

      // if (msg.cmd === 'block') {
      //   console.log('Block!')
      //   console.log(msg.block.toBlock())
      //   return
      // }

      // if (msg.cmd === 'inv') {
      //   peer.getData(msg.items)
      // }
    })
  })

  tpool.startSync()
})()
