const BaseError = require('standard-error')

class RescheduleError extends BaseError {
  constructor (msg, chain, props) {
    super(msg, props)
    this.chain = chain
  }
}

RescheduleError.prototype.name = 'RescheduleError'

class PossibleTimelockError extends RescheduleError {}
PossibleTimelockError.prototype.name = 'PossibleTimelockError'

module.exports.RescheduleError = RescheduleError
module.exports.PossibleTimelockError = PossibleTimelockError
