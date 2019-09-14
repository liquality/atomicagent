/* eslint-env mocha */

// function testFunds () {
//   describe('Create Custom Loan Fund', () => {
//     before(async function () {
//       await fundArbiter()
//       await generateSecretHashesArbiter('DAI')
//     })

//     it('should create a new loan fund and deposit funds into it', async () => {
//       const currentTime = Math.floor(new Date().getTime() / 1000)

//       const collateral = 'BTC'
//       const principal = 'DAI'
//       const custom = true
//       const arbiter = await getWeb3Address(arbiterChain)

//       console.log('create custom loan fund arbiter', arbiter)

//       const compoundEnabled = false
//       const amount = 0
//       const maxLoanDuration = 0
//       const maxFundDuration = currentTime + toSecs({ days: 100 })
//       const liquidationRatio = 150 // 150% collateralization ratio
//       const interest = 16.5 // 16.5% APR
//       const penalty = 3 // 3% APR
//       const fee = 0.75 // 0.75% APR

//       const unit = currencies[principal].unit
//       const amountToDeposit = toWei('200', unit)

//       const { body: loanMarkets } = await chai.request(lenderServer).get('/loanmarketinfo')
//       const { body: addresses } = await chai.request(lenderServer).get(`/agentinfo/${loanMarkets[0].id}`)
//       const { principalAddress } = addresses

//       await chains.ethereumWithNode.client.chain.sendTransaction(principalAddress, toWei('1', 'ether'))

//       const { body } = await chai.request(lenderServer).post('/funds/new').send({
//         collateral, principal, custom, arbiter, compoundEnabled, amount, maxLoanDuration, maxFundDuration, liquidationRatio, interest, penalty, fee
//       })
//       const { fundId } = body

//       const address = await getWeb3Address(web3Chain)

//       const { address: ethereumWithNodeAddress } = await chains.ethereumWithNode.client.wallet.getUnusedAddress()

//       const token = await testLoadObject('erc20', process.env[`${principal}_ADDRESS`], chains.web3WithNode, ensure0x(ethereumWithNodeAddress))
//       await token.methods.transfer(address, amountToDeposit).send({ gas: 6000000 })

//       const testToken = await getTestObject(web3Chain, 'erc20', principal)
//       await testToken.methods.approve(process.env[`${principal}_LOAN_FUNDS_ADDRESS`], amountToDeposit).send({ gas: 6000000 })

//       console.log(`Depositing ${principal} to Loan Fund`)

//       const testFunds = await getTestObject(web3Chain, 'funds', principal)
//       await testFunds.methods.deposit(numToBytes32(fundId), amountToDeposit).send({ gas: 6000000 })

//       const {
//         lender, maxLoanDur, maxFundDur, interest: actualInterest, penalty: actualPenalty, fee: actualFee, liquidationRatio: actualLiquidationRatio, balance
//       } = await testFunds.methods.funds(numToBytes32(fundId)).call()

//       const fundStruct = await testFunds.methods.funds(numToBytes32(fundId)).call()
//       console.log(`Deposited Funds to Loan Fund: ${fundId}`, fundStruct)

//       console.log('Loan Fund', fundId, 'Balance:', fromWei(balance, unit), principal)

//       expect(fromWei(balance, 'wei')).to.equal(amountToDeposit)

//       expect(lender).to.equal(checksumEncode(principalAddress))
//       expect(maxLoanDur).to.equal(BN(2).pow(256).minus(1).toFixed())
//       expect(maxFundDur).to.equal(maxFundDuration.toString())
//       expect(actualLiquidationRatio).to.equal(toWei((liquidationRatio / 100).toString(), 'gether'))
//       expect(actualInterest).to.equal(toWei(rateToSec(interest.toString()), 'gether'))
//       expect(actualPenalty).to.equal(toWei(rateToSec(penalty.toString()), 'gether'))
//       expect(actualFee).to.equal(toWei(rateToSec(fee.toString()), 'gether'))
//     })
//   })
// }

// describe('Lender Agent', () => {
//   describe('Web3HDWallet / BitcoinJs', () => {
//     before(async function () {
//       await importBitcoinAddresses(chains.bitcoinWithJs)
//       await fundUnusedBitcoinAddress(chains.bitcoinWithJs)
//       await fundWeb3Address(chains.web3WithHDWallet)
//       const address = await getWeb3Address(chains.web3WithHDWallet)
//       rewriteEnv('.env', 'ETH_SIGNER', address)
//       await cancelLoans(chains.web3WithHDWallet)
//       rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
//     })
//     testLenderAgent(chains.web3WithHDWallet, chains.bitcoinWithJs)
//   })

//   describe('MetaMask / Ledger', () => {
//     connectMetaMask()
//     before(async function () {
//       await importBitcoinAddresses(chains.bitcoinWithLedger)
//       await fundUnusedBitcoinAddress(chains.bitcoinWithLedger)
//       await fundWeb3Address(chains.web3WithMetaMask)
//       const address = await getWeb3Address(chains.web3WithMetaMask)
//       rewriteEnv('.env', 'ETH_SIGNER', address)
//       await cancelLoans(chains.web3WithMetaMask)
//       rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
//     })
//     testLenderAgent(chains.web3WithMetaMask, chains.bitcoinWithLedger)
//   })

//   describe('MetaMask / BitcoinJs', () => {
//     connectMetaMask()
//     before(async function () {
//       await importBitcoinAddresses(chains.bitcoinWithJs)
//       await fundUnusedBitcoinAddress(chains.bitcoinWithJs)
//       await fundWeb3Address(chains.web3WithMetaMask)
//       const address = await getWeb3Address(chains.web3WithMetaMask)
//       rewriteEnv('.env', 'ETH_SIGNER', address)
//       await cancelLoans(chains.web3WithMetaMask)
//       rewriteEnv('.env', 'MNEMONIC', `"${generateMnemonic(128)}"`)
//     })
//     testLenderAgent(chains.web3WithMetaMask, chains.bitcoinWithJs)
//   })
// })
