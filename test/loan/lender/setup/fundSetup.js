const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised')
const web3 = require('web3')

const { getWeb3Address } = require('../../util/web3Helpers')
const { getTestObjects, fundTokens } = require('../../loanCommon')
const { numToBytes32 } = require('../../../../src/utils/finance')
const { currencies } = require('../../../../src/utils/fx')
const { sleep } = require('../../../../src/utils/async')
const fundFixtures = require('../fixtures/fundFixtures')

const { toWei } = web3.utils

chai.should()

chai.use(chaiHttp)
chai.use(chaiAsPromised)

const server = 'http://localhost:3030/api/loan'

async function createCustomFund (web3Chain, arbiterChain, amount, principal) {
  const currentTime = Math.floor(new Date().getTime() / 1000)
  const address = await getWeb3Address(web3Chain)
  const fundParams = fundFixtures.customFundWithFundExpiryIn100Days(currentTime, principal)
  const [token, funds] = await getTestObjects(web3Chain, principal, ['erc20', 'funds'])
  const unit = currencies[principal].unit
  const amountToDeposit = toWei(amount.toString(), unit)
  await fundTokens(address, amountToDeposit, principal)

  const { body } = await chai.request(server).post('/funds/new').send(fundParams)
  const { id: fundModelId } = body

  const fundId = await checkFundCreated(fundModelId)

  await token.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send({ gas: 100000 })
  await funds.methods.deposit(numToBytes32(fundId), amountToDeposit).send({ gas: 100000 })

  return fundId
}

async function depositToFund (web3Chain, amount, principal) {
  const address = await getWeb3Address(web3Chain)
  const [token, funds] = await getTestObjects(web3Chain, principal, ['erc20', 'funds'])
  const unit = currencies[principal].unit
  const amountToDeposit = toWei(amount.toString(), unit)
  await fundTokens(address, amountToDeposit, principal)

  const { body, status } = await chai.request(server).get(`/funds/ticker/${principal}`)
  console.log('body', body)
  console.log('status', status)
  const { fundId } = body

  await token.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send({ gas: 100000 })
  await funds.methods.deposit(numToBytes32(fundId), amountToDeposit).send({ gas: 100000 })

  return fundId
}

async function checkFundCreated (fundModelId) {
  let created = false
  let fundId
  while (!created) {
    await sleep(1000)
    const { body } = await chai.request(server).get(`/funds/${fundModelId}`)
    const { status } = body
    if (status === 'CREATED') {
      created = true
      fundId = body.fundId
    }
  }

  return fundId
}

module.exports = {
  createCustomFund,
  depositToFund,
  checkFundCreated
}
