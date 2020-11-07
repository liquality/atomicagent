const mongoose = require('mongoose')

const JobSchema = new mongoose.Schema({}, {
  collection: 'agendaJobs',
  strict: false
})

JobSchema.static('findByOrderId', function (orderId) {
  return Job.find({ 'data.orderId': orderId }).select('-_id').exec()
})

const Job = mongoose.model('Job', JobSchema)
module.exports = Job
