const BaseError = require('standard-error')

class RescheduleError extends BaseError {
  constructor (msg, chain, props) {
    super(msg, props)
    this.chain = chain
  }
}

RescheduleError.prototype.name = 'RescheduleError'

module.exports.RescheduleError = RescheduleError
