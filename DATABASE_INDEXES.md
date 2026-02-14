# Database Indexes for Transaction API

This document describes the MongoDB indexes required for optimal performance of the transaction API.

## Collections

### 1. `transactions` Collection

The following indexes are required for efficient querying:

#### Index 1: userId + date (descending)
```javascript
db.transactions.createIndex({ userId: 1, date: -1 })
```
**Purpose**: Default transaction listing sorted by date

#### Index 2: userId + accountId + date (descending)
```javascript
db.transactions.createIndex({ userId: 1, accountId: 1, date: -1 })
```
**Purpose**: Filter transactions by account

#### Index 3: userId + type
```javascript
db.transactions.createIndex({ userId: 1, type: 1 })
```
**Purpose**: Filter transactions by type (expense/income/transfer)

#### Index 4: userId + category
```javascript
db.transactions.createIndex({ userId: 1, category: 1 })
```
**Purpose**: Filter transactions by category

#### Index 5: userId + status
```javascript
db.transactions.createIndex({ userId: 1, status: 1 })
```
**Purpose**: Filter transactions by status (completed/pending/cancelled)

#### Index 6: userId + toAccountId (sparse)
```javascript
db.transactions.createIndex({ userId: 1, toAccountId: 1 }, { sparse: true })
```
**Purpose**: Find transfers to a specific account (sparse because only transfers have toAccountId)

### 2. `custom_categories` Collection

The following indexes are required:

#### Index 1: userId + type
```javascript
db.custom_categories.createIndex({ userId: 1, type: 1 })
```
**Purpose**: List custom categories by type (expense/income)

#### Index 2: userId + name + type (unique)
```javascript
db.custom_categories.createIndex({ userId: 1, name: 1, type: 1 }, { unique: true })
```
**Purpose**: Ensure unique category names per user and type

## Setup Instructions

### Option 1: Run the Setup Script

Execute the provided setup script:

```bash
node scripts/setup-transaction-indexes.js
```

This script will:
- Connect to your MongoDB database
- Create all required indexes
- Display a summary of created indexes

### Option 2: Manual Setup via MongoDB Shell

Connect to your MongoDB instance and run:

```javascript
use smartwealth

// Transactions indexes
db.transactions.createIndex({ userId: 1, date: -1 })
db.transactions.createIndex({ userId: 1, accountId: 1, date: -1 })
db.transactions.createIndex({ userId: 1, type: 1 })
db.transactions.createIndex({ userId: 1, category: 1 })
db.transactions.createIndex({ userId: 1, status: 1 })
db.transactions.createIndex({ userId: 1, toAccountId: 1 }, { sparse: true })

// Custom categories indexes
db.custom_categories.createIndex({ userId: 1, type: 1 })
db.custom_categories.createIndex({ userId: 1, name: 1, type: 1 }, { unique: true })
```

### Option 3: MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to the `transactions` collection
4. Go to the "Indexes" tab
5. Click "Create Index" for each index listed above
6. Repeat for the `custom_categories` collection

## Verification

To verify indexes are created, run:

```javascript
// Check transactions indexes
db.transactions.getIndexes()

// Check custom_categories indexes
db.custom_categories.getIndexes()
```

## Performance Considerations

- **Query Performance**: These indexes significantly improve query performance for common operations like filtering by account, date range, category, and type.
- **Write Performance**: Indexes add a small overhead to write operations (inserts/updates/deletes), but this is negligible compared to the query performance gains.
- **Disk Space**: Each index consumes disk space. Monitor your database size if you have millions of transactions.
- **Index Maintenance**: MongoDB automatically maintains indexes. No manual maintenance is required.

## Index Usage Examples

### Query 1: List user's transactions by date
```javascript
db.transactions.find({ userId: ObjectId("...") }).sort({ date: -1 })
// Uses: userId_date_desc
```

### Query 2: Filter by account
```javascript
db.transactions.find({ 
  userId: ObjectId("..."), 
  accountId: ObjectId("...") 
}).sort({ date: -1 })
// Uses: userId_accountId_date_desc
```

### Query 3: Filter by type
```javascript
db.transactions.find({ 
  userId: ObjectId("..."), 
  type: "expense" 
})
// Uses: userId_type
```

### Query 4: Filter by category
```javascript
db.transactions.find({ 
  userId: ObjectId("..."), 
  category: "Food & Dining" 
})
// Uses: userId_category
```

## Troubleshooting

### Issue: Unique constraint violation on custom_categories
**Cause**: Attempting to create a category with a name that already exists for the user and type.
**Solution**: Check existing categories before creating new ones.

### Issue: Slow queries despite indexes
**Cause**: Query not using the expected index.
**Solution**: Use `.explain()` to analyze query execution:
```javascript
db.transactions.find({ userId: ObjectId("...") }).explain("executionStats")
```

### Issue: Index creation fails
**Cause**: Existing data violates index constraints (e.g., duplicate category names).
**Solution**: Clean up data before creating unique indexes.
