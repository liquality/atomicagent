const debug = require('debug')('liquality:agent:chain-lock')

const EventEmitter = require('events')
const _ = require('lodash')
const { assets } = require('@liquality/cryptoassets')

const { RescheduleError } = require('./errors')

let counter = 0

const PENDING = {}
const CHAIN_LOCK_TIMESTAMP = {}
const CHAIN_LOCK = {}

const emitter = new EventEmitter()
emitter.setMaxListeners(20)

const wait = (millis) => new Promise((resolve) => setTimeout(() => resolve(), millis))
const waitForRandom = (min, max) => wait(_.random(min, max))

const RETRY_ON = [
  'TxNotFoundError',
  'PendingTxError',
  'BlockNotFoundError',
  'InsufficientBalanceError',
  'RescheduleError',
  'PossibleTimelockError'
]

const attemptToLockChain = (asset) => {
  const chain = assets[asset].chain

  if (CHAIN_LOCK[chain]) {
    return {
      chain,
      success: false
    }
  }

  CHAIN_LOCK[chain] = true

  return {
    chain,
    success: true
  }
}

const unlockAsset = (chain) => {
  CHAIN_LOCK[chain] = false

  emitter.emit(`unlock:${chain}`)
}

const getLockForAsset = async (asset, id) => {
  const { chain, success } = attemptToLockChain(asset)

  if (!PENDING[chain]) PENDING[chain] = new Set()

  if (!success) {
    if (!PENDING[chain].has(id)) {
      PENDING[chain].add(id)
      debug(`${PENDING[chain].size} actions pending for ${chain} [#${id}]`)
    }

    await new Promise((resolve) => emitter.once(`unlock:${chain}`, () => resolve()))

    return getLockForAsset(asset, id)
  }

  PENDING[chain].delete(id)

  const previousTimestamp = CHAIN_LOCK_TIMESTAMP[chain]

  if (previousTimestamp) {
    const now = Date.now()
    const sincePreviousLock = now - previousTimestamp
    const minGap = _.random(3500, 7000)
    const diff = minGap - sincePreviousLock

    if (diff >= 0) {
      debug(`Waiting for ${diff}ms before unlocking ${chain} [#${id}]`)
      await wait(diff)
    }
  }

  debug(`Got lock for ${chain} [#${id}] - (Pending IDs: ${[...PENDING[chain]]})`)

  CHAIN_LOCK_TIMESTAMP[chain] = Date.now()

  return chain
}

const withRetry = async (asset, func) => {
  try {
    const result = await func()
    return result
  } catch (e) {
    if (RETRY_ON.includes(e.name)) {
      throw new RescheduleError(e.message, asset)
    }

    if (e.message.includes('opcode 0xfe not defined') || e.message.includes('execution reverted')) {
      throw new RescheduleError(e.message, asset)
    }

    throw e
  }
}

const withLock = async (asset, func) => {
  const id = ++counter
  const chain = await getLockForAsset(asset, id)

  try {
    const result = await withRetry(asset, func)
    return result
  } finally {
    unlockAsset(chain)
    debug(`Unlocked ${chain} [#${id}] - (Pending IDs: ${[...PENDING[chain]]})`)
  }
}

module.exports = {
  withRetry,
  withLock,
  wait,
  waitForRandom
}
