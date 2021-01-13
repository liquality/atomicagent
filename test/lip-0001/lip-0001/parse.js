/*
  Custom URL parser as the built in version doesn't allow for overriding the parsing of parameters to types
  e.g. rate is not a string, should be a float
*/
const Url = require('url-parse')

/*
  JSON Schema Validator
*/
const Validator = require('jsonschema').Validator

/*
  Ethereum EIP address validator
*/
const eip55 = require('eip55')

/*
  Bitcoin JS Lib for bitcoin validation
*/
const bitcoin = require('bitcoinjs-lib')

/*
  Default network to test, should lossibly be automatically detected based on the inputs
*/
const NETWORK = bitcoin.networks.testnet

Validator.prototype.customFormats.address = function (input, m) {
  try {
    if (/^0x/.test(input)) {
      input = eip55.verify(input)
    } else {
      bitcoin.address.toOutputScript(input, NETWORK)
    }
    return true
  } catch (e) {
    return false
  }
}

/*
  Create validator instance
*/
const v = new Validator()

/*
  Custom URI querystring parser for checking types
*/
function querystring (query) {
  const parser = /([^=?&]+)=?([^&]*)/g
  const result = {}

  let part

  function parse () {
    part = parser.exec(query)
    return part
  }

  while (parse()) { /* eslint-ignore */
    const key = decodeURIComponent(part[1].replace(/\+/g, ' '))
    let value = decodeURIComponent(part[2].replace(/\+/g, ' '))

    switch (key) {
      case 'rate':
        value = parseFloat(value)
        break
    }

    if (key === null || value === null || key in result) continue
    result[key] = value
  }

  return result
}

/*
  Create Url Object from swap uri
*/
const uri = new Url('swap://127.0.0.1/?from=BTC&to=ETH&rate=30&fromCounterPartyAddress=0x454f8D6e2b0F6Ca13638cE6E00904D5E75CBA291&toCounterPartyAddress=mvSHVS5pxyjoAnSaFqV5jBGVfFA3rqQJLs', null, querystring)

/*
  JSON schema for validating swap URI
*/
const schema = {
  id: '/SwapURI',
  type: 'object',
  properties: {
    from: {
      type: 'string',
      enum: ['BTC', 'ETH']
    },
    to: {
      type: 'string',
      enum: ['BTC', 'ETH']
    },
    rate: {
      type: 'number',
      minimum: 0
    },
    fromCounterPartyAddress: {
      type: 'string',
      format: 'address'
    },
    toCounterPartyAddress: {
      type: 'string',
      format: 'address'
    }
  }
}

/*
  Get JSON object for query string
*/
const params = uri.query

/*
  Validate URI params against schema
*/
console.log(v.validate(params, schema))
