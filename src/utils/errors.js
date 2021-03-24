const BaseError = require('standard-error')

function createError (name) {
  class Err extends BaseError {}
  Err.prototype.name = name
  return Err
}

class RescheduleError extends BaseError {
  constructor (msg, chain, props) {
    super(msg, props)
    this.chain = chain
  }
}

class PossibleTimelockError extends RescheduleError {}

module.exports.RescheduleError = RescheduleError
module.exports.PossibleTimelockError = PossibleTimelockError
module.exports.MarketNotFoundError = createError('MarketNotFoundError')
module.exports.MarketNotActiveError = createError('MarketNotActiveError')
module.exports.InvalidAmountError = createError('InvalidAmountError')
module.exports.CounterPartyInsufficientBalanceError = createError('CounterPartyInsufficientBalanceError')
module.exports.OrderNotFoundError = createError('OrderNotFoundError')
module.exports.UnauthorisedError = createError('UnauthorisedError')
module.exports.InvalidOrderStateError = createError('InvalidOrderStateError')
module.exports.InvalidHashError = createError('InvalidHashError')
module.exports.InvalidHTTPBodyError = createError('InvalidHTTPBodyError')
module.exports.DuplicateOrderError = createError('DuplicateOrderError')
