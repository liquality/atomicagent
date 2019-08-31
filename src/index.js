if (process.env.NODE_ENV === 'development') {
  require('dotenv').config()
}

const mongoose = require('mongoose')

if (process.env.MONGOOSE_DEBUG === 'true') {
  mongoose.set('debug', true)
}

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useCreateIndex: true })

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
