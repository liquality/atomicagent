const mongoose = require('mongoose')

module.exports.find = orderId => {
  return new Promise((resolve, reject) => {
    mongoose.connection.db.collection('agendaJobs', (err, collection) => {
      if (err) {
        reject(err)
        return
      }

      collection.find({ 'data.orderId': orderId }).toArray((err, jobs) => {
        if (err) {
          reject(err)
          return
        }

        resolve(jobs)
      })
    })
  })
}
