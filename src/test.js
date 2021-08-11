const mongoose = require('mongoose')
const config = require('./config')

console.log('[DEVING] process.env.CONFIG_PATH:', process.env.CONFIG_PATH)
// console.log('[DEVING] config:', config)

const mongoUri = config.database.uri
const mongoDebug = config.database.debug

// Build connection to Mongo
if (mongoDebug) mongoose.set('debug', true)
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.connection
  .on('error', console.error.bind(console, 'connection error:'))
  .once('open', () => console.info('Connected to MongoDB.'))


// Create schema/model for testing
const CharacterSchema = new mongoose.Schema({
  first_name: {
    type: String
  },
  last_name: {
    type: String
  }
})
const Character = mongoose.model('Character', CharacterSchema)

runTest()

async function runTest () {
  const data = await Character.find({}).exec()
  console.log('Rick and Morty characters:')
  console.log(data)
}
