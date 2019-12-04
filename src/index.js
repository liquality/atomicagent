const mongoose = require('mongoose')
const config = require('./config')

if (config.database.debug) {
  mongoose.set('debug', true)
}

mongoose.connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })

switch (process.env.PROCESS_TYPE) {
  case 'api':
    require('./api').start()
    break

  case 'worker':
    require('./worker').start()
    break

  case 'migrate':
    require('./migrate').run()
    break

  default:
    throw new Error('Unknown PROCESS_TYPE')
}
