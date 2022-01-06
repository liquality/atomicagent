const mongoose = require('mongoose')

const connect = async (options) => {
  mongoose.set('debug', options.debug)

  const mongooseOnError = (err) => {
    console.error(err)
    process.exit(1)
  }

  mongoose
    .connect(options.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: false
    })
    .catch(mongooseOnError)

  mongoose.connection.on('error', mongooseOnError)
}

module.exports = {
  connect
}
