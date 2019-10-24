const mongoose = require('mongoose')
const config = require('./config')

if (config.database.debug === 'true') {
  mongoose.set('debug', true)
}

mongoose.connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })

switch (process.env.PROCESS_TYPE) {
  case 'api':
    require('./api')
    break

  case 'worker':
    require('./worker')
    break

  case 'migrate':
    require('./migrate')
    break

  default:
    throw new Error('Unknown PROCESS_TYPE')
}
