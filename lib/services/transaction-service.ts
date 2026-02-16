import { ObjectId, ClientSession } from 'mongodb'
import { connectToDatabase } from '@/lib/database'
import { Transaction, TransactionType, CurrencyConversion } from '@/lib/types'
import { BalanceService } from './balance-service'
import { isValidCategory } from '@/lib/constants/categories'

export interface CreateTransactionInput {
  userId: ObjectId
  type: TransactionType
  amount: number
  currency: string
  accountId: ObjectId
  toAccountId?: ObjectId
  category: string
  subcategory?: string
  description: string
  notes?: string
  tags?: string[]
  date: Date
  status?: 'completed' | 'pending'
  currencyConversion?: CurrencyConversion
  // Multi-currency support
  originalAmount?: number
  originalCurrency?: string
  usdAmount?: number
  exchangeRate?: number
}

export interface UpdateTransactionInput {
  description?: string
  notes?: string
  category?: string
  subcategory?: string
  tags?: string[]
  date?: Date
  status?: 'completed' | 'pending' | 'cancelled'
  // Balance-affecting fields
  amount?: number
  accountId?: ObjectId
  toAccountId?: ObjectId
  type?: TransactionType
}

export class TransactionService {
  /**
   * Create a new transaction with balance updates
   */
  static async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    return BalanceService.executeInTransaction(async (session) => {
      const { db } = await connectToDatabase()
      const transactionsCollection = db.collection('transactions')
      const accountsCollection = db.collection('accounts')

      // Validate accounts exist and belong to user
      const account = await accountsCollection.findOne(
        { _id: input.accountId, userId: input.userId },
        { session }
      )
      if (!account) {
        throw new Error('Source account not found or unauthorized')
      }

      // Validate category
      if (input.type !== 'transfer') {
        const categoryType = input.type === 'expense' ? 'expense' : 'income'
        const isValid = isValidCategory(input.category, categoryType)
        
        if (!isValid) {
          // Check if it's a custom category
          const customCategoriesCollection = db.collection('custom_categories')
          const customCategory = await customCategoriesCollection.findOne(
            { userId: input.userId, name: input.category, type: categoryType },
            { session }
          )
          if (!customCategory) {
            throw new Error(`Invalid category: ${input.category}`)
          }
        }
      }

      // For transfers, validate destination account
      if (input.type === 'transfer') {
        if (!input.toAccountId) {
          throw new Error('Destination account required for transfers')
        }
        if (input.accountId.equals(input.toAccountId)) {
          throw new Error('Source and destination accounts must be different')
        }
        const toAccount = await accountsCollection.findOne(
          { _id: input.toAccountId, userId: input.userId },
          { session }
        )
        if (!toAccount) {
          throw new Error('Destination account not found or unauthorized')
        }
      }

      // Create transaction document
      const transaction: Omit<Transaction, '_id'> = {
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        category: input.category,
        subcategory: input.subcategory,
        description: input.description,
        notes: input.notes,
        tags: input.tags,
        date: input.date,
        status: input.status || 'completed',
        currencyConversion: input.currencyConversion,
        originalAmount: input.originalAmount,
        originalCurrency: input.originalCurrency,
        usdAmount: input.usdAmount,
        exchangeRate: input.exchangeRate,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Insert transaction
      const result = await transactionsCollection.insertOne(transaction, { session })

      // Update balances based on transaction type
      if (transaction.status === 'completed') {
        await this.applyBalanceChanges(transaction, session)
      }

      return {
        ...transaction,
        _id: result.insertedId
      } as Transaction
    })
  }

  /**
   * Apply balance changes for a transaction
   */
  private static async applyBalanceChanges(
    transaction: Omit<Transaction, '_id'>,
    session: ClientSession
  ): Promise<void> {
    switch (transaction.type) {
      case 'expense':
        await BalanceService.updateBalance(
          transaction.accountId,
          transaction.amount,
          'subtract',
          session
        )
        break

      case 'income':
        await BalanceService.updateBalance(
          transaction.accountId,
          transaction.amount,
          'add',
          session
        )
        break

      case 'transfer':
        if (!transaction.toAccountId) {
          throw new Error('Destination account required for transfers')
        }
        // Deduct from source
        await BalanceService.updateBalance(
          transaction.accountId,
          transaction.amount,
          'subtract',
          session
        )
        // Add to destination (use converted amount if available)
        const destinationAmount = transaction.currencyConversion
          ? transaction.currencyConversion.toAmount
          : transaction.amount
        await BalanceService.updateBalance(
          transaction.toAccountId,
          destinationAmount,
          'add',
          session
        )
        break
    }
  }

  /**
   * Revert balance changes for a transaction
   */
  private static async revertBalanceChanges(
    transaction: Transaction,
    session: ClientSession
  ): Promise<void> {
    switch (transaction.type) {
      case 'expense':
        await BalanceService.updateBalance(
          transaction.accountId,
          transaction.amount,
          'add',
          session
        )
        break

      case 'income':
        await BalanceService.updateBalance(
          transaction.accountId,
          transaction.amount,
          'subtract',
          session
        )
        break

      case 'transfer':
        if (!transaction.toAccountId) {
          throw new Error('Destination account required for transfers')
        }
        // Add back to source
        await BalanceService.updateBalance(
          transaction.accountId,
          transaction.amount,
          'add',
          session
        )
        // Deduct from destination
        const destinationAmount = transaction.currencyConversion
          ? transaction.currencyConversion.toAmount
          : transaction.amount
        await BalanceService.updateBalance(
          transaction.toAccountId,
          destinationAmount,
          'subtract',
          session
        )
        break
    }
  }

  /**
   * Update a transaction
   */
  static async updateTransaction(
    transactionId: ObjectId,
    userId: ObjectId,
    updates: UpdateTransactionInput
  ): Promise<Transaction> {
    return BalanceService.executeInTransaction(async (session) => {
      const { db } = await connectToDatabase()
      const transactionsCollection = db.collection('transactions')

      // Get existing transaction
      const existingTransaction = await transactionsCollection.findOne(
        { _id: transactionId, userId },
        { session }
      ) as Transaction | null

      if (!existingTransaction) {
        throw new Error('Transaction not found or unauthorized')
      }

      // Check if balance-affecting fields are being updated
      const balanceAffectingUpdate =
        updates.amount !== undefined ||
        updates.accountId !== undefined ||
        updates.toAccountId !== undefined ||
        updates.type !== undefined

      // If balance-affecting, revert old changes and apply new ones
      if (balanceAffectingUpdate && existingTransaction.status === 'completed') {
        // Revert old balance changes
        await this.revertBalanceChanges(existingTransaction, session)

        // Apply new balance changes with updated values
        const updatedTransaction = {
          ...existingTransaction,
          ...updates
        }
        await this.applyBalanceChanges(updatedTransaction, session)
      }

      // Update transaction document
      const updateDoc: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date()
      }

      const result = await transactionsCollection.findOneAndUpdate(
        { _id: transactionId, userId },
        { $set: updateDoc },
        { returnDocument: 'after', session }
      )

      if (!result) {
        throw new Error('Failed to update transaction')
      }

      return result as Transaction
    })
  }

  /**
   * Delete a transaction
   */
  static async deleteTransaction(
    transactionId: ObjectId,
    userId: ObjectId
  ): Promise<void> {
    return BalanceService.executeInTransaction(async (session) => {
      const { db } = await connectToDatabase()
      const transactionsCollection = db.collection('transactions')

      // Get transaction to revert balance changes
      const transaction = await transactionsCollection.findOne(
        { _id: transactionId, userId },
        { session }
      ) as Transaction | null

      if (!transaction) {
        throw new Error('Transaction not found or unauthorized')
      }

      // Revert balance changes if transaction was completed
      if (transaction.status === 'completed') {
        await this.revertBalanceChanges(transaction, session)
      }

      // Delete transaction
      await transactionsCollection.deleteOne(
        { _id: transactionId, userId },
        { session }
      )
    })
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(
    transactionId: ObjectId,
    userId: ObjectId
  ): Promise<Transaction | null> {
    const { db } = await connectToDatabase()
    const transactionsCollection = db.collection('transactions')

    const transaction = await transactionsCollection.findOne({
      _id: transactionId,
      userId
    })

    return transaction as Transaction | null
  }

  /**
   * List transactions with filters and pagination
   */
  static async listTransactions(
    userId: ObjectId,
    filters: {
      accountId?: ObjectId
      type?: TransactionType
      category?: string
      startDate?: Date
      endDate?: Date
      status?: 'completed' | 'pending' | 'cancelled'
    },
    pagination: {
      page: number
      limit: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    }
  ): Promise<{ transactions: Transaction[]; total: number; page: number; totalPages: number }> {
    const { db } = await connectToDatabase()
    const transactionsCollection = db.collection('transactions')

    // Build query
    const query: Record<string, unknown> = { userId }

    if (filters.accountId) {
      // Only show transactions where this account is the primary account
      // QIF already records both sides of transfers, so we don't need $or
      query.accountId = filters.accountId
    }
    if (filters.type) {
      query.type = filters.type
    }
    if (filters.category) {
      query.category = filters.category
    }
    if (filters.status) {
      query.status = filters.status
    }
    if (filters.startDate || filters.endDate) {
      query.date = {}
      if (filters.startDate) {
        (query.date as Record<string, unknown>).$gte = filters.startDate
      }
      if (filters.endDate) {
        (query.date as Record<string, unknown>).$lte = filters.endDate
      }
    }

    // Count total
    const total = await transactionsCollection.countDocuments(query)

    // Calculate pagination
    const skip = (pagination.page - 1) * pagination.limit
    const sortField = pagination.sortBy || 'date'
    const sortOrder = pagination.sortOrder === 'asc' ? 1 : -1

    // Get transactions with proper tie-breakers for deterministic sorting
    const transactions = await transactionsCollection
      .find(query)
      .sort({ [sortField]: sortOrder, createdAt: sortOrder, _id: sortOrder })
      .skip(skip)
      .limit(pagination.limit)
      .toArray()

    return {
      transactions: transactions as Transaction[],
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit)
    }
  }
}
