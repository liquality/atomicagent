const mongoose = require('mongoose')
const mongoConnect = require('./utils/mongoConnect')
const config = require('./config')

console.log('[DEVING] process.env.CONFIG_PATH:', process.env.CONFIG_PATH)
// console.log('[DEVING] config:', config)
console.log('[DEVING] PROCESS_TYPE:', process.env.PROCESS_TYPE)

// Load db settings and establish connection
const dbConfig = config.database || {}
mongoConnect.connect(dbConfig)

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

switch (process.env.PROCESS_TYPE) {
  case 'api':
    // require('./api').start()
    console.log('Start API')
    break

  case 'worker':
    // require('./worker').start()
    console.log('Start Worker')
    break

  case 'migrate':
    // require('./migrate').run()
    console.log('Run Migrate')
    break

  default:
    // throw new Error('Unknown PROCESS_TYPE')
    console.log('No process defined')
}
