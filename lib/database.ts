import { MongoClient, Db, Collection, Document } from 'mongodb'

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI || ''
const MONGODB_DB = process.env.MONGODB_DB || 'smartwealth'

// Use global to persist connection across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined
  // eslint-disable-next-line no-var
  var _mongoDb: Db | undefined
}

let cachedClient: MongoClient | null = global._mongoClient || null
let cachedDb: Db | null = global._mongoDb || null

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required')
  }

  if (cachedClient && cachedDb) {
    try {
      // Test if connection is still alive with a quick timeout
      await Promise.race([
        cachedDb.admin().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 2000))
      ])
      return { client: cachedClient, db: cachedDb }
    } catch (error) {
      // Connection is stale, close it properly and clear cache
      console.log('MongoDB connection stale, closing and reconnecting...')
      try {
        await cachedClient?.close()
      } catch (closeError) {
        console.log('Error closing stale connection:', closeError)
      }
      cachedClient = null
      cachedDb = null
      global._mongoClient = undefined
      global._mongoDb = undefined
    }
  }

  // Create new connection with retry logic
  let retries = 3
  let lastError: Error | null = null
  
  while (retries > 0) {
    try {
      const client = await MongoClient.connect(MONGODB_URI, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      })

      const db = client.db(MONGODB_DB)

      cachedClient = client
      cachedDb = db
      
      // Persist in global for dev mode hot reloads
      global._mongoClient = client
      global._mongoDb = db

      return { client, db }
    } catch (error) {
      lastError = error as Error
      retries--
      console.log(`MongoDB connection failed, ${retries} retries left...`)
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
  
  throw lastError || new Error('Failed to connect to MongoDB after retries')
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    if (cachedClient) {
      console.log('Closing MongoDB connection...')
      await cachedClient.close()
      process.exit(0)
    }
  })
  
  process.on('SIGTERM', async () => {
    if (cachedClient) {
      console.log('Closing MongoDB connection...')
      await cachedClient.close()
      process.exit(0)
    }
  })
}

/**
 * Get a collection from the database
 * This is the main function to use for accessing database collections
 */
export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const { db } = await connectToDatabase()
  return db.collection<T>(name)
}

/**
 * Get the database instance
 * Useful for transactions and other database-level operations
 */
export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase()
  return db
}
