const mongoose = require('mongoose')

const AuditLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      index: true
    },

    orderStatus: {
      type: String,
      index: true
    },

    status: {
      type: String,
      index: true
    },

    context: {
      type: String,
      index: true
    },

    extra: {
      type: Object,
      default: {}
    }
  },
  { timestamps: true }
)

AuditLogSchema.methods.json = function () {
  const json = this.toJSON()

  delete json._id
  delete json.__v

  return json
}

module.exports = mongoose.model('AuditLog', AuditLogSchema)
