const mongoose = require('mongoose')
const config = require('../src/config')

const Market = require('../src/models/Market')
const Order = require('../src/models/Order')
const markets = require('../src/migrate/data/markets.json')

module.exports.prepare = () => mongoose
  .connect(config.database.uri, { useNewUrlParser: true, useCreateIndex: true })
  .then(() => Order.deleteMany({}))
  .then(() => Market.deleteMany({}))
  .then(() => Market.insertMany(markets, { ordered: false }))
  .then(() => mongoose.connection.db.collection('agendaJobs').deleteMany({}))
  .then(() => require('../src/worker'))

module.exports.sleep = duration => new Promise((resolve, reject) => {
  setTimeout(resolve, duration)
})
