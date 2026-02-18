const { MongoClient } = require('mongodb')
const fs = require('fs')
require('dotenv').config({ path: '.env' })

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB

// Parse QIF file
function parseQIF() {
  const qifContent = fs.readFileSync("edib's quicken data.QIF", 'utf-8')
  const lines = qifContent.split('\n')
  
  let transactions = []
  let currentTx = {}
  let inENBD = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line === '!Account') {
      const nextLine = lines[i + 1]?.trim()
      inENBD = nextLine === 'NENBD'
      continue
    }
    
    if (!inENBD) continue
    
    if (line === '^') {
      if (currentTx.date && currentTx.amount !== undefined) {
        transactions.push({ ...currentTx })
      }
      currentTx = {}
    } else if (line.startsWith('D')) {
      currentTx.date = line.substring(1)
    } else if (line.startsWith('T')) {
      currentTx.amount = parseFloat(line.substring(1).replace(/,/g, ''))
    } else if (line.startsWith('P')) {
      currentTx.description = line.substring(1)
    }
  }
  
  return transactions
}

async function fixMigratedDataWithSignedAmounts() {
  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const transactionsCollection = db.collection('transactions')
    const accountsCollection = db.collection('accounts')

    // Get all ENBD account IDs
    const enbdAccounts = await accountsCollection
      .find({ name: { $regex: /ENBD/i } })
      .toArray()
    const enbdAccountIds = enbdAccounts.map(acc => acc._id.toString())

    const enbdAccount = await accountsCollection.findOne({ 
      name: 'ENBD',
      currency: 'AED'
    })

    console.log(`\n🔧 Fixing migrated data using QIF amounts\n`)
    console.log(`ENBD Account ID: ${enbdAccount._id}\n`)

    // Get QIF transactions
    const qifTransactions = parseQIF()
    
    // Get MongoDB transactions where ENBD is SOURCE (up to Aug 14)
    const mongoTransactions = await transactionsCollection
      .find({
        accountId: enbdAccount._id,
        status: 'completed',
        date: { $lte: new Date('2025-08-14T23:59:59.999Z') }
      })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .toArray()

    console.log(`📊 Transactions up to Aug 14, 2025:`)
    console.log(`   QIF: ${qifTransactions.length}`)
    console.log(`   MongoDB: ${mongoTransactions.length}`)
    console.log()

    if (mongoTransactions.length !== qifTransactions.length) {
      console.log(`⚠️ Warning: Transaction count mismatch!`)
      console.log(`   This script will only fix the first ${Math.min(mongoTransactions.length, qifTransactions.length)} transactions`)
      console.log()
    }

    // Fix signedAmount using QIF amounts
    const updates = []
    let runningBalance = 0

    for (let i = 0; i < Math.min(mongoTransactions.length, qifTransactions.length); i++) {
      const mongoTx = mongoTransactions[i]
      const qifTx = qifTransactions[i]
      
      // Use QIF amount (which has correct sign) as signedAmount
      const signedAmount = qifTx.amount
      runningBalance += signedAmount

      updates.push({
        updateOne: {
          filter: { _id: mongoTx._id },
          update: { 
            $set: { 
              signedAmount: signedAmount,
              runningBalance: runningBalance 
            } 
          }
        }
      })

      if ((i + 1) % 500 === 0) {
        console.log(`   Processed ${i + 1}/${mongoTransactions.length} transactions...`)
      }
    }

    console.log(`\n📝 Updating ${updates.length} transactions with corrected signedAmount...`)
    
    if (updates.length > 0) {
      await transactionsCollection.bulkWrite(updates)
      console.log(`✅ Updated ${updates.length} transactions`)
    }

    console.log(`\n💰 Balance up to Aug 14, 2025: ${runningBalance.toFixed(2)} AED`)

    // Now process post-Aug14 transactions
    const postAug14Transactions = await transactionsCollection
      .find({
        accountId: enbdAccount._id,
        status: 'completed',
        date: { $gt: new Date('2025-08-14T23:59:59.999Z') }
      })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .toArray()

    console.log(`\n📊 Processing ${postAug14Transactions.length} post-Aug14 transactions...`)
    
    const postUpdates = []
    for (const tx of postAug14Transactions) {
      // For post-Aug14, signedAmount should already be set correctly
      // Just recalculate running balance
      runningBalance += tx.signedAmount

      postUpdates.push({
        updateOne: {
          filter: { _id: tx._id },
          update: { $set: { runningBalance: runningBalance } }
        }
      })
    }

    if (postUpdates.length > 0) {
      await transactionsCollection.bulkWrite(postUpdates)
      console.log(`✅ Updated ${postUpdates.length} post-Aug14 transactions`)
    }

    // Update account balance
    await accountsCollection.updateOne(
      { _id: enbdAccount._id },
      { $set: { balance: runningBalance } }
    )

    console.log(`\n✅ DONE!`)
    console.log(`\n💰 ENBD (AED) Final Balance: ${runningBalance.toFixed(2)} AED`)
    console.log(`   Expected: -144,000 AED`)
    console.log(`   Difference: ${(runningBalance - (-144000)).toFixed(2)} AED`)

  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error.stack)
  } finally {
    await client.close()
  }
}

fixMigratedDataWithSignedAmounts()
