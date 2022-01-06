const mongoose = require('mongoose')

const CheckSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      index: true,
      unique: true
    },

    flags: {
      type: Object,
      default: {}
    }
  },
  { timestamps: true }
)

CheckSchema.static('getCheckForOrder', async function (orderId) {
  return (await Check.findOne({ orderId }).exec()) || new Check({ orderId })
})

const Check = mongoose.model('Check', CheckSchema)
module.exports = Check
