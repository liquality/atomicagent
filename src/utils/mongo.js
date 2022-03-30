const debug = require('debug')('liquality:agent:mongo')
const mongoose = require('mongoose')
const config = require('../config')

const connect = async () => {
  mongoose.set('debug', config.database.debug)

  mongoose.connection.on('error', debug)

  return mongoose.connect(config.database.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: false
  })
}

module.exports = {
  mongoose,
  connect,
  disconnect: () => mongoose.disconnect()
}
