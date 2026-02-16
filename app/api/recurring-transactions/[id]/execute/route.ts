import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { RecurringTransaction, Transaction } from '@/lib/types'
import { calculateNextDueDate } from '@/lib/utils/recurring'
import { getNextPaymentBreakdown } from '@/lib/utils/loan-calculator'

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

    // Parse request body for optional custom amounts (for loan payments)
    const body = await request.json().catch(() => ({}))
    const { principalAmount, interestAmount } = body

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
        currency: recurringTx.currency,
        accountId: recurringTx.accountId,
        toAccountId: recurringTx.toAccountId,
        transferDirection: 'out',
        category: 'Principal',
        description: `${recurringTx.description} - Principal`,
        notes: recurringTx.notes,
        date: now,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id
      }

      sourceRunningBalance -= principal
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
          currency: recurringTx.currency,
          accountId: recurringTx.toAccountId,
          toAccountId: recurringTx.accountId,
          transferDirection: 'in',
          category: 'Principal',
          description: `${recurringTx.description} - Principal`,
          notes: recurringTx.notes,
          date: now,
          createdAt: now,
          updatedAt: now,
          status: 'completed',
          runningBalance: loanRunningBalance,
          isRecurring: true,
          recurringId: recurringTx._id
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
        currency: recurringTx.currency,
        accountId: recurringTx.accountId,
        category: 'Interest',
        description: `${recurringTx.description} - Interest`,
        notes: recurringTx.notes,
        date: now,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id
      }

      sourceRunningBalance -= interest
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
            lastExecutedAt: now,
            nextDueDate: calculateNextDueDate(
              recurringTx.nextDueDate,
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
        const splitTransaction: Omit<Transaction, '_id'> = {
          userId: user._id,
          type: split.type === 'transfer' ? 'transfer' : 'expense',
          amount: split.amount,
          currency: recurringTx.currency,
          accountId: recurringTx.accountId,
          toAccountId: split.toAccountId,
          category: split.category,
          description: split.description || `${recurringTx.description} - ${split.category}`,
          notes: recurringTx.notes,
          date: now,
          createdAt: now,
          updatedAt: now,
          status: 'completed',
          isRecurring: true,
          recurringId: recurringTx._id
        }

        // Set transfer direction for transfers
        if (split.type === 'transfer') {
          splitTransaction.transferDirection = 'out'
        }

        // Update running balance for source account
        sourceRunningBalance -= split.amount
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
            currency: recurringTx.currency,
            accountId: split.toAccountId,
            toAccountId: recurringTx.accountId,
            transferDirection: 'in',
            category: split.category,
            description: split.description || `${recurringTx.description} - ${split.category}`,
            notes: recurringTx.notes,
            date: now,
            createdAt: now,
            updatedAt: now,
            status: 'completed',
            runningBalance: destRunningBalance,
            isRecurring: true,
            recurringId: recurringTx._id
          }

          await transactionsCollection.insertOne(destTransaction as Transaction)
        }
      }
    } else {
      // Regular (non-split) transaction
      const newTransaction: Omit<Transaction, '_id'> = {
        userId: user._id,
        type: recurringTx.type,
        amount: recurringTx.amount,
        currency: recurringTx.currency,
        accountId: recurringTx.accountId,
        toAccountId: recurringTx.toAccountId,
        category: recurringTx.category,
        subcategory: recurringTx.subcategory,
        description: recurringTx.description,
        notes: recurringTx.notes,
        date: now,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id
      }

      // For transfers, set transferDirection
      if (recurringTx.type === 'transfer' && recurringTx.toAccountId) {
        newTransaction.transferDirection = 'out'
      }

      // Get the latest transaction's running balance for this account
      const latestTransaction = await transactionsCollection.findOne(
        { 
          userId: user._id, 
          accountId: recurringTx.accountId 
        },
        { sort: { date: -1, createdAt: -1, _id: -1 } }
      )

      // Calculate running balance for the new transaction
      let runningBalance = latestTransaction?.runningBalance ?? 0
      
      if (newTransaction.type === 'income') {
        runningBalance += newTransaction.amount
      } else if (newTransaction.type === 'expense') {
        runningBalance -= newTransaction.amount
      } else if (newTransaction.type === 'transfer' && newTransaction.transferDirection === 'out') {
        runningBalance -= newTransaction.amount
      }

      // Insert the transaction with running balance
      newTransaction.runningBalance = runningBalance
      const txResult = await transactionsCollection.insertOne(newTransaction as Transaction)
      const createdTransaction = await transactionsCollection.findOne({ _id: txResult.insertedId })
      if (createdTransaction) createdTransactions.push(createdTransaction)
    }

    // If it's a regular (non-split) transfer, create the corresponding transaction for the destination account
    if (!recurringTx.isSplit && recurringTx.type === 'transfer' && recurringTx.toAccountId) {
      const transferInTransaction: Omit<Transaction, '_id'> = {
        userId: user._id,
        type: 'transfer',
        amount: recurringTx.amount,
        currency: recurringTx.currency,
        accountId: recurringTx.toAccountId,
        toAccountId: recurringTx.accountId,
        transferDirection: 'in',
        category: recurringTx.category,
        subcategory: recurringTx.subcategory,
        description: recurringTx.description,
        notes: recurringTx.notes,
        date: now,
        createdAt: now,
        updatedAt: now,
        status: 'completed',
        isRecurring: true,
        recurringId: recurringTx._id
      }

      // Get the latest transaction's running balance for destination account
      const latestToTransaction = await transactionsCollection.findOne(
        { 
          userId: user._id, 
          accountId: recurringTx.toAccountId 
        },
        { sort: { date: -1, createdAt: -1, _id: -1 } }
      )

      // Calculate running balance for the destination account
      let toAccountBalance = latestToTransaction?.runningBalance ?? 0
      toAccountBalance += transferInTransaction.amount

      // Insert the transfer-in transaction with running balance
      transferInTransaction.runningBalance = toAccountBalance
      await transactionsCollection.insertOne(transferInTransaction as Transaction)
    }

    // Calculate next due date
    const nextDueDate = calculateNextDueDate(
      recurringTx.nextDueDate,
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
          lastExecutedAt: now,
          updatedAt: now
        } 
      }
    )

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
