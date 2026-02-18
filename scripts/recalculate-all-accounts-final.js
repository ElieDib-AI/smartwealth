const { MongoClient } = require('mongodb')
require('dotenv').config({ path: '.env' })

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB

async function recalculateAllAccountsFinal() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const transactionsCollection = db.collection('transactions')
    const accountsCollection = db.collection('accounts')

    console.log(`\n🔧 Recalculating ALL account balances using signedAmount\n`)

    // Get all accounts
    const allAccounts = await accountsCollection.find({}).sort({ name: 1 }).toArray()

    console.log(`📊 Found ${allAccounts.length} accounts to process\n`)

    for (const account of allAccounts) {
      console.log(`🔄 ${account.name} (${account.currency})`)

      // Get all transactions for this account (where accountId = this account)
      const transactions = await transactionsCollection
        .find({
          accountId: account._id,
          status: 'completed'
        })
        .sort({ date: 1, createdAt: 1, _id: 1 })
        .toArray()

      // Calculate running balances using signedAmount
      let runningBalance = 0
      const updates = []

      for (const tx of transactions) {
        if (tx.signedAmount === undefined) {
          console.log(`   ⚠️ Transaction ${tx._id} missing signedAmount!`)
          continue
        }

        runningBalance += tx.signedAmount

        updates.push({
          updateOne: {
            filter: { _id: tx._id },
            update: { $set: { runningBalance: runningBalance } }
          }
        })
      }

      // Apply updates
      if (updates.length > 0) {
        await transactionsCollection.bulkWrite(updates)
      }

      // Update account balance
      await accountsCollection.updateOne(
        { _id: account._id },
        { $set: { balance: runningBalance } }
      )

      console.log(`   ✅ ${transactions.length} transactions, balance: ${runningBalance.toFixed(2)} ${account.currency}`)
    }

    console.log(`\n✅ ALL DONE!`)

    // Show key account balances
    console.log(`\n💰 KEY ACCOUNT BALANCES:\n`)
    
    const keyAccounts = ['ENBD', 'HSBC UAE', 'ENBD $', 'HSBC Leb', 'CS']
    for (const accountName of keyAccounts) {
      const account = await accountsCollection.findOne({ name: accountName })
      if (account) {
        console.log(`   ${account.name} (${account.currency}): ${account.balance.toFixed(2)}`)
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error.stack)
  } finally {
    await client.close()
  }
}

recalculateAllAccountsFinal()
