const { MongoClient } = require('mongodb')
require('dotenv').config({ path: '.env' })

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB

async function addSignedAmountToAllTransactions() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const transactionsCollection = db.collection('transactions')

    console.log(`\n🔧 Adding signedAmount to all existing transactions\n`)

    // Get all transactions
    const allTransactions = await transactionsCollection
      .find({})
      .toArray()

    console.log(`📊 Found ${allTransactions.length} transactions to process\n`)

    const updates = []
    let processedCount = 0

    for (const tx of allTransactions) {
      // Skip if signedAmount already exists
      if (tx.signedAmount !== undefined) {
        continue
      }

      let signedAmount

      switch (tx.type) {
        case 'income':
          signedAmount = tx.amount // Positive
          break
        
        case 'expense':
          signedAmount = -tx.amount // Negative
          break
        
        case 'transfer':
          // Determine direction from accountId/toAccountId relationship
          // If transferDirection exists, use it (but we know it's unreliable for migrated data)
          // For now, use the old logic as a starting point
          if (tx.transferDirection === 'out') {
            signedAmount = -tx.amount // Money leaving
          } else if (tx.transferDirection === 'in') {
            signedAmount = tx.amount // Money entering
          } else {
            // Fallback: assume 'out' if no direction specified
            signedAmount = -tx.amount
          }
          break
        
        default:
          console.log(`⚠️ Unknown transaction type: ${tx.type} for transaction ${tx._id}`)
          signedAmount = 0
      }

      updates.push({
        updateOne: {
          filter: { _id: tx._id },
          update: { $set: { signedAmount: signedAmount } }
        }
      })

      processedCount++

      if (processedCount % 1000 === 0) {
        console.log(`   Processed ${processedCount}/${allTransactions.length} transactions...`)
      }
    }

    if (updates.length > 0) {
      console.log(`\n📝 Updating ${updates.length} transactions...`)
      await transactionsCollection.bulkWrite(updates)
      console.log(`✅ Updated ${updates.length} transactions with signedAmount`)
    } else {
      console.log(`✅ All transactions already have signedAmount`)
    }

    console.log(`\n✅ DONE!`)
    console.log(`\nNote: For migrated data (up to Aug 14, 2025), run the fix-migrated-data script`)
    console.log(`to correct the signedAmount values using QIF data.`)

  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error.stack)
  } finally {
    await client.close()
  }
}

addSignedAmountToAllTransactions()
