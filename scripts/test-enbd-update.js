const { MongoClient, ObjectId } = require('mongodb')
require('dotenv').config()

async function testENBDUpdate() {
  const client = new MongoClient(process.env.MONGODB_URI)
  
  try {
    await client.connect()
    const db = client.db()
    
    // Find ENBD account
    const account = await db.collection('accounts')
      .findOne({ name: 'ENBD' })
    
    console.log('🏦 ENBD Account ID:', account._id)
    
    // Count completed transactions
    const count = await db.collection('transactions')
      .countDocuments({ accountId: account._id, status: 'completed' })
    
    console.log(`📊 Completed transactions: ${count}`)
    
    // Test how long it takes to fetch and sort them
    console.log('\n⏱️  Testing fetch and sort performance...')
    const start = Date.now()
    
    const transactions = await db.collection('transactions')
      .find({ accountId: account._id, status: 'completed' })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .toArray()
    
    const fetchTime = Date.now() - start
    console.log(`   Fetched ${transactions.length} transactions in ${fetchTime}ms`)
    
    // Estimate update time (without actually updating)
    console.log(`\n⚠️  Estimated time to update all transactions: ${Math.round(transactions.length * 10 / 1000)}s`)
    console.log('   (assuming ~10ms per update)')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await client.close()
  }
}

testENBDUpdate().catch(console.error)
