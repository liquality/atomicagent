const BN = require('bignumber.js')

const WAD = BN(10).pow(18)
const RAY = BN(10).pow(27)

// Multiply WAD values
function wmul (a, b) {
  BN(a).times(b).div(WAD)
}

// Divide WAD values
function wdiv (a, b) {
  BN(a).times(WAD).div(b)
}

// Multiply RAY values
function rmul (a, b) {
  BN(a).times(b).div(RAY)
}

// Divide RAY values
function rdiv (a, b) {
  BN(a).times(RAY).div(b)
}

module.exports = {
  wmul,
  wdiv,
  rmul,
  rdiv
}
