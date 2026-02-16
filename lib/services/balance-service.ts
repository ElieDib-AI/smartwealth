import { ObjectId, ClientSession } from 'mongodb'
import { connectToDatabase } from '@/lib/database'

export interface BalanceUpdate {
  accountId: ObjectId
  amount: number
  operation: 'add' | 'subtract'
}

export class BalanceService {
  /**
   * Update account balance atomically within a MongoDB session
   */
  static async updateBalance(
    accountId: ObjectId,
    amount: number,
    operation: 'add' | 'subtract',
    session: ClientSession | null
  ): Promise<void> {
    const { db } = await connectToDatabase()
    const accountsCollection = db.collection('accounts')

    const updateAmount = operation === 'add' ? amount : -amount

    const options = session ? { session } : {}
    const result = await accountsCollection.updateOne(
      { _id: accountId },
      {
        $inc: { balance: updateAmount },
        $set: { updatedAt: new Date() }
      },
      options
    )

    if (result.matchedCount === 0) {
      throw new Error(`Account ${accountId.toString()} not found`)
    }
  }

  /**
   * Update multiple account balances atomically within a MongoDB session
   */
  static async updateMultipleBalances(
    updates: BalanceUpdate[],
    session: ClientSession | null
  ): Promise<void> {
    for (const update of updates) {
      await this.updateBalance(
        update.accountId,
        update.amount,
        update.operation,
        session
      )
    }
  }

  /**
   * Revert a balance update (used when updating or deleting transactions)
   */
  static async revertBalanceUpdate(
    accountId: ObjectId,
    amount: number,
    originalOperation: 'add' | 'subtract',
    session: ClientSession | null
  ): Promise<void> {
    // Reverse the operation
    const revertOperation = originalOperation === 'add' ? 'subtract' : 'add'
    await this.updateBalance(accountId, amount, revertOperation, session)
  }

  /**
   * Get current account balance
   */
  static async getAccountBalance(accountId: ObjectId): Promise<number> {
    const { db } = await connectToDatabase()
    const accountsCollection = db.collection('accounts')

    const account = await accountsCollection.findOne(
      { _id: accountId },
      { projection: { balance: 1 } }
    )

    if (!account) {
      throw new Error(`Account ${accountId.toString()} not found`)
    }

    return account.balance as number
  }

  /**
   * Validate if account has sufficient balance (warning only, not blocking)
   */
  static async checkSufficientBalance(
    accountId: ObjectId,
    amount: number
  ): Promise<{ sufficient: boolean; currentBalance: number }> {
    const currentBalance = await this.getAccountBalance(accountId)
    return {
      sufficient: currentBalance >= amount,
      currentBalance
    }
  }

  /**
   * Execute a function within a MongoDB transaction session
   * Falls back to non-transactional execution if transactions are not supported
   */
  static async executeInTransaction<T>(
    callback: (session: ClientSession | null) => Promise<T>
  ): Promise<T> {
    const { client } = await connectToDatabase()
    
    // Check if transactions are supported (requires replica set)
    const useTransactions = process.env.MONGODB_USE_TRANSACTIONS !== 'false'
    
    if (!useTransactions) {
      // Execute without transaction
      return await callback(null)
    }
    
    const session = client.startSession()

    try {
      let result: T
      await session.withTransaction(async () => {
        result = await callback(session)
      })
      return result!
    } catch (error) {
      // If transaction fails due to replica set requirement, fall back to non-transactional
      if (error instanceof Error && error.message.includes('replica set')) {
        console.warn('MongoDB transactions not supported, falling back to non-transactional execution')
        return await callback(null)
      }
      throw error
    } finally {
      await session.endSession()
    }
  }
}
