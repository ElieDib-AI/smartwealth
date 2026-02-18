const { MongoClient } = require('mongodb')
require('dotenv').config({ path: '.env' })

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB

async function verifyAllAccountBalances() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const transactionsCollection = db.collection('transactions')
    const accountsCollection = db.collection('accounts')

    console.log(`\n🔍 COMPREHENSIVE ACCOUNT BALANCE VERIFICATION\n`)

    // Get all accounts
    const allAccounts = await accountsCollection.find({}).sort({ name: 1 }).toArray()

    console.log(`📊 Found ${allAccounts.length} accounts to verify\n`)

    let totalAccounts = 0
    let correctAccounts = 0
    let incorrectAccounts = 0
    let accountsWithIssues = []

    for (const account of allAccounts) {
      totalAccounts++

      // Get all transactions for this account (where accountId = this account)
      const transactions = await transactionsCollection
        .find({
          accountId: account._id,
          status: 'completed'
        })
        .sort({ date: 1, createdAt: 1, _id: 1 })
        .toArray()

      // Calculate balance using signedAmount
      let calculatedBalance = 0
      let hasSignedAmount = true

      for (const tx of transactions) {
        if (tx.signedAmount === undefined) {
          hasSignedAmount = false
          break
        }
        calculatedBalance += tx.signedAmount
      }

      // Check if stored balance matches calculated balance
      const storedBalance = account.balance || 0
      const difference = Math.abs(storedBalance - calculatedBalance)
      const isCorrect = difference < 0.01 // Allow 1 cent rounding difference

      if (!hasSignedAmount) {
        accountsWithIssues.push({
          name: account.name,
          currency: account.currency,
          issue: 'Missing signedAmount on some transactions',
          stored: storedBalance,
          calculated: 'N/A',
          transactions: transactions.length
        })
        incorrectAccounts++
      } else if (!isCorrect) {
        accountsWithIssues.push({
          name: account.name,
          currency: account.currency,
          issue: 'Balance mismatch',
          stored: storedBalance,
          calculated: calculatedBalance,
          difference: difference,
          transactions: transactions.length
        })
        incorrectAccounts++
      } else {
        correctAccounts++
      }

      // Progress indicator
      if (totalAccounts % 10 === 0) {
        console.log(`   Verified ${totalAccounts}/${allAccounts.length} accounts...`)
      }
    }

    console.log(`\n✅ Verification Complete!\n`)
    console.log(`📊 SUMMARY:`)
    console.log(`   Total accounts: ${totalAccounts}`)
    console.log(`   Correct balances: ${correctAccounts}`)
    console.log(`   Incorrect balances: ${incorrectAccounts}`)
    console.log(`   Accuracy: ${((correctAccounts / totalAccounts) * 100).toFixed(2)}%`)

    if (accountsWithIssues.length > 0) {
      console.log(`\n⚠️ ACCOUNTS WITH ISSUES:\n`)
      accountsWithIssues.forEach((acc, idx) => {
        console.log(`${idx + 1}. ${acc.name} (${acc.currency})`)
        console.log(`   Issue: ${acc.issue}`)
        console.log(`   Transactions: ${acc.transactions}`)
        if (acc.stored !== undefined) {
          console.log(`   Stored balance: ${acc.stored.toFixed(2)} ${acc.currency}`)
        }
        if (acc.calculated !== 'N/A') {
          console.log(`   Calculated balance: ${acc.calculated.toFixed(2)} ${acc.currency}`)
          console.log(`   Difference: ${acc.difference.toFixed(2)} ${acc.currency}`)
        }
        console.log()
      })

      console.log(`\n💡 RECOMMENDATION:`)
      if (accountsWithIssues.some(acc => acc.issue.includes('signedAmount'))) {
        console.log(`   Some transactions are missing signedAmount. Run:`)
        console.log(`   node scripts/add-signed-amount-to-all-transactions.js`)
      }
      if (accountsWithIssues.some(acc => acc.issue.includes('mismatch'))) {
        console.log(`   Some balances are incorrect. Need to recalculate running balances.`)
      }
    } else {
      console.log(`\n🎉 ALL ACCOUNTS HAVE CORRECT BALANCES!`)
    }

    // Additional checks
    console.log(`\n\n🔍 ADDITIONAL CHECKS:\n`)

    // Check for transactions without signedAmount
    const txWithoutSignedAmount = await transactionsCollection.countDocuments({
      signedAmount: { $exists: false }
    })
    console.log(`1. Transactions without signedAmount: ${txWithoutSignedAmount}`)
    if (txWithoutSignedAmount > 0) {
      console.log(`   ⚠️ Found ${txWithoutSignedAmount} transactions missing signedAmount`)
    } else {
      console.log(`   ✅ All transactions have signedAmount`)
    }

    // Check for transactions without runningBalance
    const txWithoutRunningBalance = await transactionsCollection.countDocuments({
      status: 'completed',
      runningBalance: { $exists: false }
    })
    console.log(`\n2. Completed transactions without runningBalance: ${txWithoutRunningBalance}`)
    if (txWithoutRunningBalance > 0) {
      console.log(`   ⚠️ Found ${txWithoutRunningBalance} completed transactions missing runningBalance`)
    } else {
      console.log(`   ✅ All completed transactions have runningBalance`)
    }

    // Check for negative balances in asset accounts (might be unusual)
    const negativeAssetAccounts = await accountsCollection.find({
      category: { $in: ['bank', 'investments', 'assets'] },
      balance: { $lt: 0 }
    }).toArray()
    
    console.log(`\n3. Asset accounts with negative balance: ${negativeAssetAccounts.length}`)
    if (negativeAssetAccounts.length > 0) {
      console.log(`   ℹ️ These accounts have negative balances (might be expected):`)
      negativeAssetAccounts.forEach(acc => {
        console.log(`      - ${acc.name} (${acc.currency}): ${acc.balance.toFixed(2)}`)
      })
    } else {
      console.log(`   ✅ No asset accounts with negative balance`)
    }

    // Check for positive balances in liability accounts (might be unusual)
    const positiveLiabilityAccounts = await accountsCollection.find({
      category: 'credit_loans',
      balance: { $gt: 0 }
    }).toArray()
    
    console.log(`\n4. Liability accounts with positive balance: ${positiveLiabilityAccounts.length}`)
    if (positiveLiabilityAccounts.length > 0) {
      console.log(`   ℹ️ These liability accounts have positive balances (might be expected):`)
      positiveLiabilityAccounts.forEach(acc => {
        console.log(`      - ${acc.name} (${acc.currency}): ${acc.balance.toFixed(2)}`)
      })
    } else {
      console.log(`   ✅ No liability accounts with positive balance`)
    }

    console.log(`\n\n✅ VERIFICATION COMPLETE!`)

  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error.stack)
  } finally {
    await client.close()
  }
}

verifyAllAccountBalances()
