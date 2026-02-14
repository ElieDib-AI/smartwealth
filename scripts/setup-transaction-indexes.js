/**
 * MongoDB Index Setup Script for Transactions and Custom Categories
 * 
 * This script creates the necessary indexes for optimal query performance
 * on the transactions and custom_categories collections.
 * 
 * Run this script once after deploying the transaction API:
 * node scripts/setup-transaction-indexes.js
 */

const { MongoClient } = require('mongodb')
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_DB = process.env.MONGODB_DB

if (!MONGODB_URI || !MONGODB_DB) {
  console.error('Error: MONGODB_URI and MONGODB_DB must be set in .env file')
  process.exit(1)
}

async function setupIndexes() {
  const client = new MongoClient(MONGODB_URI)

  try {
    console.log('Connecting to MongoDB...')
    await client.connect()
    console.log('Connected successfully')

    const db = client.db(MONGODB_DB)

    // Setup transactions collection indexes
    console.log('\nSetting up indexes for transactions collection...')
    const transactionsCollection = db.collection('transactions')

    await transactionsCollection.createIndex(
      { userId: 1, date: -1 },
      { name: 'userId_date_desc' }
    )
    console.log('✓ Created index: userId_date_desc')

    await transactionsCollection.createIndex(
      { userId: 1, accountId: 1, date: -1 },
      { name: 'userId_accountId_date_desc' }
    )
    console.log('✓ Created index: userId_accountId_date_desc')

    await transactionsCollection.createIndex(
      { userId: 1, type: 1 },
      { name: 'userId_type' }
    )
    console.log('✓ Created index: userId_type')

    await transactionsCollection.createIndex(
      { userId: 1, category: 1 },
      { name: 'userId_category' }
    )
    console.log('✓ Created index: userId_category')

    await transactionsCollection.createIndex(
      { userId: 1, status: 1 },
      { name: 'userId_status' }
    )
    console.log('✓ Created index: userId_status')

    await transactionsCollection.createIndex(
      { userId: 1, toAccountId: 1 },
      { name: 'userId_toAccountId', sparse: true }
    )
    console.log('✓ Created index: userId_toAccountId (sparse)')

    // Setup custom_categories collection indexes
    console.log('\nSetting up indexes for custom_categories collection...')
    const customCategoriesCollection = db.collection('custom_categories')

    await customCategoriesCollection.createIndex(
      { userId: 1, type: 1 },
      { name: 'userId_type' }
    )
    console.log('✓ Created index: userId_type')

    await customCategoriesCollection.createIndex(
      { userId: 1, name: 1, type: 1 },
      { name: 'userId_name_type_unique', unique: true }
    )
    console.log('✓ Created index: userId_name_type_unique (unique)')

    // List all indexes
    console.log('\n--- Transactions Collection Indexes ---')
    const transactionIndexes = await transactionsCollection.indexes()
    transactionIndexes.forEach(index => {
      console.log(`  ${index.name}: ${JSON.stringify(index.key)}`)
    })

    console.log('\n--- Custom Categories Collection Indexes ---')
    const categoryIndexes = await customCategoriesCollection.indexes()
    categoryIndexes.forEach(index => {
      console.log(`  ${index.name}: ${JSON.stringify(index.key)}`)
    })

    console.log('\n✅ All indexes created successfully!')
  } catch (error) {
    console.error('Error setting up indexes:', error)
    process.exit(1)
  } finally {
    await client.close()
    console.log('\nConnection closed')
  }
}

setupIndexes()
