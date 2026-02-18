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
      const sessionOptions = session ? { session } : {}
      const account = await accountsCollection.findOne(
        { _id: input.accountId, userId: input.userId },
        sessionOptions
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
            sessionOptions
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
          sessionOptions
        )
        if (!toAccount) {
          throw new Error('Destination account not found or unauthorized')
        }
      }

      // Calculate signedAmount based on transaction type
      let signedAmount: number
      switch (input.type) {
        case 'income':
          signedAmount = input.amount // Positive
          break
        case 'expense':
          signedAmount = -input.amount // Negative
          break
        case 'transfer':
          signedAmount = -input.amount // Negative (money leaving source account)
          break
      }

      // Create transaction document
      const transaction: Omit<Transaction, '_id'> = {
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        signedAmount: signedAmount,
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

      // Calculate running balance before inserting
      let runningBalance: number | undefined
      if (transaction.status === 'completed') {
        // Find the transaction immediately before this one by date
        const previousTransaction = await transactionsCollection.findOne(
          { 
            userId: input.userId,
            accountId: input.accountId,
            status: 'completed',
            $or: [
              { date: { $lt: transaction.date } },
              { 
                date: transaction.date,
                createdAt: { $lt: transaction.createdAt }
              }
            ]
          },
          { ...sessionOptions, sort: { date: -1, createdAt: -1, _id: -1 } }
        )
        
        // Start with previous transaction's balance, or 0 if this is the first
        let startingBalance = previousTransaction?.runningBalance ?? 0
        
        // Calculate what the new balance will be after this transaction
        switch (transaction.type) {
          case 'expense':
            runningBalance = startingBalance - transaction.amount
            break
          case 'income':
            runningBalance = startingBalance + transaction.amount
            break
          case 'transfer':
            runningBalance = startingBalance - transaction.amount
            break
        }
      }

      // Add running balance to transaction
      const transactionWithBalance = {
        ...transaction,
        runningBalance
      }

      // Insert transaction (the "out" transaction for transfers)
      const result = await transactionsCollection.insertOne({
        ...transactionWithBalance,
        transferDirection: transaction.type === 'transfer' ? 'out' : undefined
      }, sessionOptions)
      const insertedId = result.insertedId

      // For transfers, create the corresponding "in" transaction in the destination account
      if (transaction.type === 'transfer' && input.toAccountId) {
        // Determine the amount for the destination account
        const destinationAmount = transaction.currencyConversion
          ? transaction.currencyConversion.toAmount
          : transaction.amount
        
        // Get destination account to determine currency
        const toAccount = await accountsCollection.findOne(
          { _id: input.toAccountId },
          sessionOptions
        )
        const destinationCurrency = toAccount?.currency || transaction.currency

        // Calculate running balance for the "in" transaction
        let inRunningBalance: number | undefined
        if (transaction.status === 'completed') {
          const previousInTransaction = await transactionsCollection.findOne(
            { 
              userId: input.userId,
              accountId: input.toAccountId,
              status: 'completed',
              $or: [
                { date: { $lt: transaction.date } },
                { 
                  date: transaction.date,
                  createdAt: { $lt: transaction.createdAt }
                }
              ]
            },
            { ...sessionOptions, sort: { date: -1, createdAt: -1, _id: -1 } }
          )
          
          const startingInBalance = previousInTransaction?.runningBalance ?? 0
          inRunningBalance = startingInBalance + destinationAmount
        }

        // Create the "in" transaction
        const inTransaction: Omit<Transaction, '_id'> = {
          userId: input.userId,
          type: 'transfer',
          amount: destinationAmount,
          signedAmount: destinationAmount, // Positive (money entering destination account)
          currency: destinationCurrency,
          accountId: input.toAccountId,
          toAccountId: input.accountId,
          category: input.category,
          subcategory: input.subcategory,
          description: input.description,
          notes: input.notes,
          tags: input.tags,
          date: input.date,
          status: input.status || 'completed',
          currencyConversion: transaction.currencyConversion,
          transferDirection: 'in',
          runningBalance: inRunningBalance,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const inResult = await transactionsCollection.insertOne(inTransaction, sessionOptions)
        const inTransactionId = inResult.insertedId
        
        // Store the in transaction ID for recalculation
        if (transaction.status === 'completed') {
          // Recalculate for destination account using the correct transaction ID
          await this.recalculateRunningBalancesFromTransaction(input.toAccountId, inTransactionId, session)
        }
      }

      // Update balances based on transaction type
      if (transaction.status === 'completed') {
        await this.applyBalanceChanges(transaction, session)
        
        // Recalculate running balances for all transactions after this one (source account)
        await this.recalculateRunningBalancesFromTransaction(input.accountId, insertedId, session)
      }

      return {
        ...transactionWithBalance,
        _id: insertedId,
        transferDirection: transaction.type === 'transfer' ? 'out' : undefined
      } as Transaction
    })
  }

  /**
   * Apply balance changes for a transaction
   */
  private static async applyBalanceChanges(
    transaction: Omit<Transaction, '_id'>,
    session: ClientSession | null
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
    session: ClientSession | null
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
   * Recalculate running balances for all transactions in an account (used after delete)
   */
  private static async recalculateAllRunningBalances(
    accountId: ObjectId,
    session: ClientSession | null
  ): Promise<void> {
    const { db } = await connectToDatabase()
    const transactionsCollection = db.collection('transactions')
    const accountsCollection = db.collection('accounts')
    const sessionOptions = session ? { session } : {}

    // Get all completed transactions for this account, sorted by date (oldest first)
    const transactions = await transactionsCollection
      .find({ accountId, status: 'completed' }, sessionOptions)
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .toArray() as Transaction[]

    if (transactions.length === 0) {
      // No transactions, set account balance to 0
      await accountsCollection.updateOne(
        { _id: accountId },
        { $set: { balance: 0, updatedAt: new Date() } },
        sessionOptions
      )
      return
    }

    // Calculate running balances
    let runningBalance = 0
    const bulkOps = []
    const now = new Date()

    for (const tx of transactions) {
      // Simple calculation using signedAmount
      // Fallback to old logic if signedAmount doesn't exist (for backward compatibility during migration)
      if (tx.signedAmount !== undefined) {
        runningBalance += tx.signedAmount
      } else {
        // Legacy fallback
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
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: tx._id },
          update: { $set: { runningBalance, updatedAt: now } }
        }
      })
    }

    // Execute bulk update
    if (bulkOps.length > 0) {
      await transactionsCollection.bulkWrite(bulkOps, sessionOptions)
    }

    // Update account balance
    await accountsCollection.updateOne(
      { _id: accountId },
      { $set: { balance: runningBalance, updatedAt: now } },
      sessionOptions
    )
  }

  /**
   * Recalculate running balances for a transaction and all subsequent transactions
   */
  /**
   * Recalculate running balances for all transactions from a specific transaction onwards
   * This is useful when a backdated transaction is inserted or a transaction is modified
   */
  static async recalculateRunningBalancesFromTransaction(
    accountId: ObjectId,
    fromTransactionId: ObjectId,
    session: ClientSession | null = null
  ): Promise<void> {
    const { db } = await connectToDatabase()
    const transactionsCollection = db.collection('transactions')
    const accountsCollection = db.collection('accounts')
    const sessionOptions = session ? { session } : {}

    // Get the transaction that was modified
    const modifiedTx = await transactionsCollection.findOne(
      { _id: fromTransactionId },
      sessionOptions
    ) as Transaction | null

    if (!modifiedTx) return

    // Get the transaction immediately before this one to get the starting balance
    const previousTx = await transactionsCollection.findOne(
      { 
        accountId, 
        status: 'completed',
        $or: [
          { date: { $lt: modifiedTx.date } },
          { 
            date: modifiedTx.date,
            $or: [
              { createdAt: { $lt: modifiedTx.createdAt } },
              { createdAt: modifiedTx.createdAt, _id: { $lt: modifiedTx._id } }
            ]
          }
        ]
      },
      { ...sessionOptions, sort: { date: -1, createdAt: -1, _id: -1 } }
    ) as Transaction | null

    // Start with the previous transaction's balance, or 0 if this is the first transaction
    let runningBalance = previousTx?.runningBalance ?? 0

    // Get all transactions from this one onwards, sorted by date
    const transactions = await transactionsCollection
      .find({ 
        accountId, 
        status: 'completed',
        $or: [
          { date: { $gt: modifiedTx.date } },
          { 
            date: modifiedTx.date,
            $or: [
              { createdAt: { $gt: modifiedTx.createdAt } },
              { createdAt: modifiedTx.createdAt, _id: { $gte: modifiedTx._id } }
            ]
          }
        ]
      }, sessionOptions)
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .toArray() as Transaction[]

    const bulkOps = []
    const now = new Date()

    for (const tx of transactions) {
      // Calculate the balance after this transaction
      // Simple calculation using signedAmount
      // Fallback to old logic if signedAmount doesn't exist (for backward compatibility during migration)
      if (tx.signedAmount !== undefined) {
        runningBalance += tx.signedAmount
      } else {
        // Legacy fallback
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
      }

      // Add to bulk operations
      bulkOps.push({
        updateOne: {
          filter: { _id: tx._id },
          update: { $set: { runningBalance, updatedAt: now } }
        }
      })
    }

    // Execute all updates in a single bulk operation
    if (bulkOps.length > 0) {
      await transactionsCollection.bulkWrite(bulkOps, sessionOptions)
    }

    // Update the account balance to match the final running balance
    await accountsCollection.updateOne(
      { _id: accountId },
      { $set: { balance: runningBalance, updatedAt: now } },
      sessionOptions
    )
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
      const sessionOptions = session ? { session } : {}

      // Get existing transaction
      const existingTransaction = await transactionsCollection.findOne(
        { _id: transactionId, userId },
        sessionOptions
      ) as Transaction | null

      if (!existingTransaction) {
        throw new Error('Transaction not found or unauthorized')
      }

      // Check if balance-affecting fields are being updated
      const balanceAffectingUpdate =
        updates.amount !== undefined ||
        updates.accountId !== undefined ||
        updates.toAccountId !== undefined ||
        updates.type !== undefined ||
        updates.date !== undefined

      // Update transaction document
      const updateDoc: Record<string, unknown> = {
        ...updates,
        updatedAt: new Date()
      }

      // If amount or type changed, recalculate signedAmount
      if (updates.amount !== undefined || updates.type !== undefined) {
        const newAmount = updates.amount ?? existingTransaction.amount
        const newType = updates.type ?? existingTransaction.type
        
        switch (newType) {
          case 'income':
            updateDoc.signedAmount = newAmount
            break
          case 'expense':
            updateDoc.signedAmount = -newAmount
            break
          case 'transfer':
            // For transfers, check if this is the source or destination
            // If toAccountId exists, this is the source (money out)
            updateDoc.signedAmount = -newAmount
            break
        }
      }

      const result = await transactionsCollection.findOneAndUpdate(
        { _id: transactionId, userId },
        { $set: updateDoc },
        { returnDocument: 'after', ...sessionOptions }
      )

      if (!result) {
        throw new Error('Failed to update transaction')
      }

      // If balance-affecting, recalculate running balances
      if (balanceAffectingUpdate && existingTransaction.status === 'completed') {
        // If date changed, we need to recalculate the entire account
        // because the transaction's position in the sort order has changed
        if (updates.date !== undefined) {
          // Recalculate entire account to ensure correct ordering
          await this.recalculateAllRunningBalances(existingTransaction.accountId, session)
          
          // If account changed, also recalculate for the new account
          if (updates.accountId && !updates.accountId.equals(existingTransaction.accountId)) {
            await this.recalculateAllRunningBalances(updates.accountId, session)
          }
          
          // If it's a transfer, recalculate for destination accounts too
          if (existingTransaction.type === 'transfer' && existingTransaction.toAccountId) {
            await this.recalculateAllRunningBalances(existingTransaction.toAccountId, session)
          }
          if (updates.toAccountId && existingTransaction.type === 'transfer') {
            await this.recalculateAllRunningBalances(updates.toAccountId, session)
          }
        } else {
          // For non-date changes, we can optimize by only recalculating from this transaction onwards
          await this.recalculateRunningBalancesFromTransaction(existingTransaction.accountId, transactionId, session)
          
          // If account changed, also recalculate for the new account
          if (updates.accountId && !updates.accountId.equals(existingTransaction.accountId)) {
            await this.recalculateRunningBalancesFromTransaction(updates.accountId, transactionId, session)
          }
          
          // If it's a transfer, recalculate for destination accounts too
          if (existingTransaction.type === 'transfer' && existingTransaction.toAccountId) {
            await this.recalculateRunningBalancesFromTransaction(existingTransaction.toAccountId, transactionId, session)
          }
          if (updates.toAccountId && existingTransaction.type === 'transfer') {
            await this.recalculateRunningBalancesFromTransaction(updates.toAccountId, transactionId, session)
          }
        }
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
      const sessionOptions = session ? { session } : {}

      // Get transaction to revert balance changes
      const transaction = await transactionsCollection.findOne(
        { _id: transactionId, userId },
        sessionOptions
      ) as Transaction | null

      if (!transaction) {
        throw new Error('Transaction not found or unauthorized')
      }

      const accountId = transaction.accountId
      const toAccountId = transaction.toAccountId

      // Delete transaction
      await transactionsCollection.deleteOne(
        { _id: transactionId, userId },
        sessionOptions
      )

      // Recalculate running balances for affected accounts (full recalc needed after delete)
      if (transaction.status === 'completed') {
        await this.recalculateAllRunningBalances(accountId, session)
        
        if (transaction.type === 'transfer' && toAccountId) {
          await this.recalculateAllRunningBalances(toAccountId, session)
        }
      }
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
