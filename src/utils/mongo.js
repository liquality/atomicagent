const debug = require('debug')('liquality:agent:mongo')
const mongoose = require('mongoose')
const config = require('../config')

const connect = async () => {
  mongoose.set('debug', config.database.debug)

  const mongooseOnError = (err) => {
    debug(err)
  }

  mongoose
    .connect(config.database.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: false
    })
    .catch(mongooseOnError)

  mongoose.connection.on('error', mongooseOnError)
}

module.exports = {
  mongoose,
  connect,
  disconnect: () => mongoose.disconnect()
}
