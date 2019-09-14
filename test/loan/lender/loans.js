/* eslint-env mocha */

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