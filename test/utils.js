const mongoose = require('mongoose')
const config = require('../src/config')

const Market = require('../src/models/Market')
const Order = require('../src/models/Order')
const markets = require('../src/migrate/data/markets.json')

const sleep = duration => new Promise((resolve, reject) => {
  setTimeout(resolve, duration)
})

module.exports.prepare = () => mongoose
  .connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })
  .then(() => Order.deleteMany({}))
  .then(() => Market.deleteMany({}))
  .then(() => Market.insertMany(markets, { ordered: false }))
  .then(() => mongoose.connection.db.collection('agendaJobs').deleteMany({}))
  .then(() => require('../src/api').start())
  .then(() => require('../src/worker').start())
  .then(() => sleep(1000))

module.exports.sleep = sleep

module.exports.mongoose = mongoose
