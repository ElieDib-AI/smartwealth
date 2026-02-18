import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { RecurringTransaction, Transaction } from '@/lib/types'
import { calculateNextDueDate } from '@/lib/utils/recurring'
import { getNextPaymentBreakdown } from '@/lib/utils/loan-calculator'
import { TransactionService } from '@/lib/services/transaction-service'

// POST /api/recurring-transactions/[id]/execute - Execute a recurring transaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid recurring transaction ID' },
        { status: 400 }
      )
    }

    // Parse request body for optional custom amounts (for loan payments) or overrides (for regular transactions)
    const body = await request.json().catch(() => ({}))
    const { principalAmount, interestAmount, amount, description, notes, date, accountId, toAccountId } = body

    const recurringCollection = await getCollection<RecurringTransaction>('recurring_transactions')
    const transactionsCollection = await getCollection<Transaction>('transactions')
    
    // Fetch the recurring transaction
    const recurringTx = await recurringCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id,
      isActive: true
    })

    if (!recurringTx) {
      return NextResponse.json(
        { success: false, error: 'Recurring transaction not found or inactive' },
        { status: 404 }
      )
    }

    const now = new Date()
    // Use the provided date (due date of the occurrence) or default to now
    const transactionDate = date ? new Date(date) : now
    // Store the original scheduled due date to track which occurrence was executed
    const recurringDueDate = date ? new Date(date) : recurringTx.nextDueDate
    const createdTransactions: Transaction[] = []

    // Handle loan payments with auto-calculated splits
    if (recurringTx.loanDetails && recurringTx.isSplit) {
      // Calculate or use provided split amounts
      let principal: number
      let interest: number

      if (principalAmount !== undefined && interestAmount !== undefined) {
        // User provided custom amounts
        principal = principalAmount
        interest = interestAmount
      } else {
        // Auto-calculate from loan details
        const breakdown = getNextPaymentBreakdown(
          recurringTx.loanDetails,
          recurringTx.lastExecutedAt
        )
        principal = breakdown.principal
        interest = breakdown.interest
      }

      // Get the latest transaction's running balance for the source account
      const latestTransaction = await transactionsCollection.findOne(
        { 
          userId: user._id, 
          accountId: recurringTx.accountId 
        },
        { sort: { date: -1, createdAt: -1, _id: -1 } }
      )

      let sourceRunningBalance = latestTransaction?.runningBalance ?? 0

      // Create principal transaction (transfer to loan account)
      const principalTransaction: Omit<Transaction, '_id'> = {
        userId: user._id,
        type: 'transfer',
        amount: principal,
        signedAmount: -principal,
        currency: recurringTx.currency,
        accountId: recurringTx.accountId,
        toAccountId: recurringTx.toAccountId,
        transferDirection: 'out',
        category: 'Principal',
        description: `${recurringTx.description} - Principal`,
        notes: recurringTx.notes,
        date: transactionDate,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id,
        recurringDueDate: recurringDueDate
      }

      sourceRunningBalance += principalTransaction.signedAmount
      principalTransaction.runningBalance = sourceRunningBalance

      const principalResult = await transactionsCollection.insertOne(principalTransaction as Transaction)
      const createdPrincipal = await transactionsCollection.findOne({ _id: principalResult.insertedId })
      if (createdPrincipal) createdTransactions.push(createdPrincipal)

      // Create corresponding "in" transaction for loan account
      if (recurringTx.toAccountId) {
        const latestLoanTransaction = await transactionsCollection.findOne(
          { 
            userId: user._id, 
            accountId: recurringTx.toAccountId 
          },
          { sort: { date: -1, createdAt: -1, _id: -1 } }
        )

        let loanRunningBalance = latestLoanTransaction?.runningBalance ?? 0
        loanRunningBalance += principal

        const loanInTransaction: Omit<Transaction, '_id'> = {
          userId: user._id,
          type: 'transfer',
          amount: principal,
          signedAmount: principal,
          currency: recurringTx.currency,
          accountId: recurringTx.toAccountId,
          toAccountId: recurringTx.accountId,
        transferDirection: 'in',
        category: 'Principal',
        description: `${recurringTx.description} - Principal`,
        notes: recurringTx.notes,
        date: transactionDate,
        createdAt: now,
        updatedAt: now,
          status: 'completed',
          runningBalance: loanRunningBalance,
          isRecurring: true,
          recurringId: recurringTx._id,
          recurringDueDate: recurringDueDate
        }

        const loanInResult = await transactionsCollection.insertOne(loanInTransaction as Transaction)
        const createdLoanIn = await transactionsCollection.findOne({ _id: loanInResult.insertedId })
        if (createdLoanIn) createdTransactions.push(createdLoanIn)
      }

      // Create interest transaction (expense)
      const interestTransaction: Omit<Transaction, '_id'> = {
        userId: user._id,
        type: 'expense',
        amount: interest,
        signedAmount: -interest,
        currency: recurringTx.currency,
        accountId: recurringTx.accountId,
        category: 'Interest',
        description: `${recurringTx.description} - Interest`,
        notes: recurringTx.notes,
        date: transactionDate,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id,
        recurringDueDate: recurringDueDate
      }

      sourceRunningBalance += interestTransaction.signedAmount
      interestTransaction.runningBalance = sourceRunningBalance

      const interestResult = await transactionsCollection.insertOne(interestTransaction as Transaction)
      const createdInterest = await transactionsCollection.findOne({ _id: interestResult.insertedId })
      if (createdInterest) createdTransactions.push(createdInterest)

      // Update loan balance
      const newBalance = (recurringTx.loanDetails.currentBalance || recurringTx.loanDetails.originalAmount) - principal

      await recurringCollection.updateOne(
        { _id: recurringTx._id },
        { 
          $set: { 
            'loanDetails.currentBalance': Math.max(0, newBalance),
            'loanDetails.lastCalculatedAt': now,
            lastExecutedAt: transactionDate,
            nextDueDate: calculateNextDueDate(
              transactionDate,
              recurringTx.frequency,
              recurringTx.interval,
              recurringTx.intervalUnit
            ),
            updatedAt: now
          } 
        }
      )

      return NextResponse.json({
        success: true,
        data: {
          transactions: createdTransactions,
          newLoanBalance: Math.max(0, newBalance)
        }
      })
    }

    // Handle regular split transactions (non-loan)
    if (recurringTx.isSplit && recurringTx.splits && recurringTx.splits.length > 0) {
      // Get the latest transaction's running balance for the source account
      const latestTransaction = await transactionsCollection.findOne(
        { 
          userId: user._id, 
          accountId: recurringTx.accountId 
        },
        { sort: { date: -1, createdAt: -1, _id: -1 } }
      )

      let sourceRunningBalance = latestTransaction?.runningBalance ?? 0

      // Create a transaction for each split part
      for (const split of recurringTx.splits) {
        const splitType = split.type === 'transfer' ? 'transfer' : 'expense'
        const signedAmount = splitType === 'transfer' ? -split.amount : -split.amount
        
        const splitTransaction: Omit<Transaction, '_id'> = {
          userId: user._id,
          type: splitType,
          amount: split.amount,
          signedAmount: signedAmount,
          currency: recurringTx.currency,
          accountId: recurringTx.accountId,
          toAccountId: split.toAccountId,
          category: split.category,
          description: split.description || `${recurringTx.description} - ${split.category}`,
          notes: recurringTx.notes,
          date: transactionDate,
          createdAt: now,
          updatedAt: now,
          status: 'completed',
          isRecurring: true,
          recurringId: recurringTx._id,
          recurringDueDate: recurringDueDate
        }

        // Set transfer direction for transfers
        if (split.type === 'transfer') {
          splitTransaction.transferDirection = 'out'
        }

        // Update running balance for source account
        sourceRunningBalance += splitTransaction.signedAmount
        splitTransaction.runningBalance = sourceRunningBalance

        // Insert the split transaction
        const splitResult = await transactionsCollection.insertOne(splitTransaction as Transaction)
        const created = await transactionsCollection.findOne({ _id: splitResult.insertedId })
        if (created) createdTransactions.push(created)

        // If it's a transfer split, create the corresponding "in" transaction for destination account
        if (split.type === 'transfer' && split.toAccountId) {
          const latestDestTransaction = await transactionsCollection.findOne(
            { 
              userId: user._id, 
              accountId: split.toAccountId 
            },
            { sort: { date: -1, createdAt: -1, _id: -1 } }
          )

          let destRunningBalance = latestDestTransaction?.runningBalance ?? 0
          destRunningBalance += split.amount

          const destTransaction: Omit<Transaction, '_id'> = {
            userId: user._id,
            type: 'transfer',
            amount: split.amount,
            signedAmount: split.amount,
            currency: recurringTx.currency,
            accountId: split.toAccountId,
            toAccountId: recurringTx.accountId,
            transferDirection: 'in',
            category: split.category,
            description: split.description || `${recurringTx.description} - ${split.category}`,
            notes: recurringTx.notes,
            date: transactionDate,
            createdAt: now,
            updatedAt: now,
            status: 'completed',
            runningBalance: destRunningBalance,
            isRecurring: true,
            recurringId: recurringTx._id,
            recurringDueDate: recurringDueDate
          }

          await transactionsCollection.insertOne(destTransaction as Transaction)
        }
      }
    } else {
      // Regular (non-split) transaction
      const transactionDate = date ? new Date(date) : now
      
      // Use override accountId if provided, otherwise use recurring transaction's accountId
      const finalAccountId = accountId ? new ObjectId(accountId) : recurringTx.accountId
      const finalToAccountId = toAccountId ? new ObjectId(toAccountId) : recurringTx.toAccountId
      
      const txAmount = amount !== undefined ? amount : recurringTx.amount
      let signedAmount: number
      
      switch (recurringTx.type) {
        case 'income':
          signedAmount = txAmount
          break
        case 'expense':
          signedAmount = -txAmount
          break
        case 'transfer':
          signedAmount = -txAmount
          break
      }
      
      const newTransaction: Omit<Transaction, '_id'> = {
        userId: user._id,
        type: recurringTx.type,
        amount: txAmount,
        signedAmount: signedAmount,
        currency: recurringTx.currency,
        accountId: finalAccountId,
        toAccountId: finalToAccountId,
        category: recurringTx.category,
        subcategory: recurringTx.subcategory,
        description: description || recurringTx.description,
        notes: notes !== undefined ? notes : recurringTx.notes,
        date: transactionDate,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id,
        recurringDueDate: recurringDueDate
      }

      // For transfers, set transferDirection
      if (recurringTx.type === 'transfer' && finalToAccountId) {
        newTransaction.transferDirection = 'out'
      }

      // Get the latest transaction's running balance for this account
      const latestTransaction = await transactionsCollection.findOne(
        { 
          userId: user._id, 
          accountId: finalAccountId 
        },
        { sort: { date: -1, createdAt: -1, _id: -1 } }
      )

      // Calculate running balance for the new transaction
      let runningBalance = latestTransaction?.runningBalance ?? 0
      runningBalance += newTransaction.signedAmount

      // Insert the transaction with running balance
      newTransaction.runningBalance = runningBalance
      const txResult = await transactionsCollection.insertOne(newTransaction as Transaction)
      const createdTransaction = await transactionsCollection.findOne({ _id: txResult.insertedId })
      if (createdTransaction) createdTransactions.push(createdTransaction)
    }

    // If it's a regular (non-split) transfer, create the corresponding transaction for the destination account
    const finalAccountId = accountId ? new ObjectId(accountId) : recurringTx.accountId
    const finalToAccountId = toAccountId ? new ObjectId(toAccountId) : recurringTx.toAccountId
    
    if (!recurringTx.isSplit && recurringTx.type === 'transfer' && finalToAccountId) {
      const transactionDate = date ? new Date(date) : now
      const transactionAmount = amount !== undefined ? amount : recurringTx.amount
      
      const transferInTransaction: Omit<Transaction, '_id'> = {
        userId: user._id,
        type: 'transfer',
        amount: transactionAmount,
        signedAmount: transactionAmount,
        currency: recurringTx.currency,
        accountId: finalToAccountId,
        toAccountId: finalAccountId,
        transferDirection: 'in',
        category: recurringTx.category,
        subcategory: recurringTx.subcategory,
        description: description || recurringTx.description,
        notes: notes !== undefined ? notes : recurringTx.notes,
        date: transactionDate,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id,
        recurringDueDate: recurringDueDate
      }

      // Get the latest transaction's running balance for destination account
      const latestToTransaction = await transactionsCollection.findOne(
        { 
          userId: user._id, 
          accountId: finalToAccountId 
        },
        { sort: { date: -1, createdAt: -1, _id: -1 } }
      )

      // Calculate running balance for the destination account
      let toAccountBalance = latestToTransaction?.runningBalance ?? 0
      toAccountBalance += transferInTransaction.signedAmount

      // Insert the transfer-in transaction with running balance
      transferInTransaction.runningBalance = toAccountBalance
      await transactionsCollection.insertOne(transferInTransaction as Transaction)
    }

    // Calculate next due date based on the transaction date (not current time)
    const nextDueDate = calculateNextDueDate(
      transactionDate,
      recurringTx.frequency,
      recurringTx.interval,
      recurringTx.intervalUnit
    )

    // Update recurring transaction
    await recurringCollection.updateOne(
      { _id: recurringTx._id },
      { 
        $set: { 
          nextDueDate,
          lastExecutedAt: transactionDate,
          updatedAt: now
        } 
      }
    )

    // Recalculate running balances for all affected accounts
    // This ensures that if the transaction is backdated, all subsequent transactions are updated
    const affectedAccounts = new Set<string>()
    createdTransactions.forEach(tx => {
      affectedAccounts.add(tx.accountId.toString())
      if (tx.toAccountId) {
        affectedAccounts.add(tx.toAccountId.toString())
      }
    })

    // Trigger recalculation for each affected account
    for (const accountIdStr of affectedAccounts) {
      const accountId = new ObjectId(accountIdStr)
      // Find the earliest transaction we created for this account
      const earliestTx = createdTransactions
        .filter(tx => 
          tx.accountId.toString() === accountIdStr || 
          tx.toAccountId?.toString() === accountIdStr
        )
        .sort((a, b) => {
          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
          if (dateCompare !== 0) return dateCompare
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        })[0]
      
      if (earliestTx) {
        await TransactionService.recalculateRunningBalancesFromTransaction(
          accountId,
          earliestTx._id,
          null // No session since we're not in a transaction
        )
      }
    }

    const updatedRecurring = await recurringCollection.findOne({ _id: recurringTx._id })

    return NextResponse.json({
      success: true,
      data: {
        transactions: createdTransactions,
        recurringTransaction: updatedRecurring
      }
    })
  } catch (error) {
    console.error('Error executing recurring transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to execute recurring transaction' 
      },
      { status: 500 }
    )
  }
}
