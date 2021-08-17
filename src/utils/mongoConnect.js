const mongoose = require('mongoose')

const connect = async (options = {}) => {
  // Load DB settings
  const dbConnectUri = options.uri
  const dbDebug = options.debug

  // The uri options take priority. If not provided, compose from parts
  const connectUri = dbConnectUri || buildConnectUri(options)

  // Connect to DB
  if (dbDebug) mongoose.set('debug', true)

  const mongooseOnError = err => {
    console.error(err)
    process.exit(1)
  }

  mongoose
    .connect(connectUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true
    })
    .catch(mongooseOnError)

  mongoose
    .connection.on('error', mongooseOnError)

  return connectUri
}

const buildConnectUri = (options = {}) => {
  const dbHost = options.host
  const dbPort = options.port
  const dbName = options.dbname
  const dbUser = options.username
  const dbPass = options.password
  const authDbName = options.authdbname

  // Handle error scenarios
  if (!dbHost) throw (new Error('A db host was not provided'))
  if (dbUser && !dbPass) throw (new Error('A db username was provided, but no password'))
  if (dbPass && !dbUser) throw (new Error('A db password was provided, but no username'))

  // Build uri from parts
  let connectUri = null
  const authPart = (dbUser && dbPass) ? `${dbUser}:${dbPass}@` : ''
  const portPart = (dbPort) ? `:${dbPort}` : ''
  const dbNamePart = (dbName) ? `/${dbName}` : ''
  const authDbNamePart = (authDbName) ? `?authSource=${authDbName}` : ''
  connectUri = `mongodb://${authPart}${dbHost}${portPart}${dbNamePart}${authDbNamePart}`

  return connectUri
}

module.exports = {
  connect,
  buildConnectUri
}
