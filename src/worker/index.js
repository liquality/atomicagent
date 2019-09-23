const mongoose = require('mongoose')
const Agenda = require('agenda')

const agenda = new Agenda({ mongo: mongoose.connection })

agenda.define('verify-user-init-tx', require('./jobs/verify-user-init-tx')(agenda))
agenda.define('reciprocate-init-swap', require('./jobs/reciprocate-init-swap')(agenda))
agenda.define('find-claim-swap-tx', require('./jobs/find-claim-swap-tx')(agenda))
agenda.define('agent-claim', require('./jobs/agent-claim')(agenda))
agenda.define('update-market-data', require('./jobs/update-market-data')(agenda))

async function start () {
  await agenda.start()
  await agenda.every('5 minutes', 'update-market-data')
}

async function stop () {
  await agenda.stop()
  process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
