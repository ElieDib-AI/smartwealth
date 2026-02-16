const { MongoClient, ObjectId } = require('mongodb')
require('dotenv').config()

async function fixENBDRunningBalances() {
  const client = new MongoClient(process.env.MONGODB_URI)
  
  try {
    await client.connect()
    const db = client.db()
    
    // Find ENBD account
    const account = await db.collection('accounts')
      .findOne({ name: 'ENBD' })
    
    if (!account) {
      console.log('❌ ENBD account not found')
      return
    }
    
    console.log('🏦 ENBD Account ID:', account._id)
    console.log('   Current Balance:', account.currency, account.balance.toLocaleString())
    
    // Get all completed transactions for this account, sorted by date (oldest first)
    const transactions = await db.collection('transactions')
      .find({ accountId: account._id, status: 'completed' })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .toArray()
    
    console.log(`\n📊 Found ${transactions.length} completed transactions`)
    console.log('\n🔄 Recalculating running balances...')
    
    let runningBalance = 0
    let updateCount = 0
    
    for (const tx of transactions) {
      // Calculate the balance after this transaction
      switch (tx.type) {
        case 'income':
          runningBalance += tx.amount
          break
        case 'expense':
          runningBalance -= tx.amount
          break
        case 'transfer':
          if (tx.transferDirection === 'out') {
            runningBalance -= tx.amount
          } else if (tx.transferDirection === 'in') {
            runningBalance += tx.amount
          }
          break
      }
      
      // Update the transaction with the new running balance
      await db.collection('transactions').updateOne(
        { _id: tx._id },
        { $set: { runningBalance, updatedAt: new Date() } }
      )
      
      updateCount++
      
      if (updateCount % 100 === 0) {
        console.log(`   Updated ${updateCount} transactions...`)
      }
    }
    
    console.log(`\n✅ Updated ${updateCount} transactions`)
    console.log(`   Final Running Balance: ${account.currency} ${runningBalance.toLocaleString()}`)
    
    // Update the account balance to match the final running balance
    await db.collection('accounts').updateOne(
      { _id: account._id },
      { $set: { balance: runningBalance, updatedAt: new Date() } }
    )
    
    console.log(`\n✅ Account balance updated to: ${account.currency} ${runningBalance.toLocaleString()}`)
    
    // Verify
    const updatedAccount = await db.collection('accounts').findOne({ _id: account._id })
    const latestTx = await db.collection('transactions')
      .find({ accountId: account._id })
      .sort({ date: -1, createdAt: -1, _id: -1 })
      .limit(1)
      .toArray()
    
    console.log('\n🔍 Verification:')
    console.log(`   Account Balance: ${updatedAccount.currency} ${updatedAccount.balance.toLocaleString()}`)
    if (latestTx.length > 0) {
      console.log(`   Latest Transaction Running Balance: ${latestTx[0].currency} ${latestTx[0].runningBalance.toLocaleString()}`)
      if (Math.abs(updatedAccount.balance - latestTx[0].runningBalance) < 0.01) {
        console.log('   ✅ Balances match!')
      } else {
        console.log('   ❌ Balances do NOT match!')
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.close()
  }
}

fixENBDRunningBalances().catch(console.error)
