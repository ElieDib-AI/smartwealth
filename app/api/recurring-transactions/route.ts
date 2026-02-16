import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { RecurringTransaction, Account } from '@/lib/types'
import { calculateInitialNextDueDate } from '@/lib/utils/recurring'

// GET /api/recurring-transactions - List all active recurring transactions
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const recurringCollection = await getCollection<RecurringTransaction>('recurring_transactions')
    const accountsCollection = await getCollection<Account>('accounts')

    // Get all active recurring transactions
    const recurringTransactions = await recurringCollection
      .find({ 
        userId: user._id,
        isActive: true 
      })
      .toArray()

    // Enrich with account names
    const accountIds = [
      ...recurringTransactions.map(rt => rt.accountId),
      ...recurringTransactions.filter(rt => rt.toAccountId).map(rt => rt.toAccountId!)
    ]
    
    const accounts = await accountsCollection
      .find({ _id: { $in: accountIds } })
      .toArray()
    
    const accountMap = new Map(accounts.map(a => [a._id.toString(), a.name]))

    const enrichedTransactions = recurringTransactions.map(rt => ({
      ...rt,
      accountName: accountMap.get(rt.accountId.toString()) || 'Unknown Account',
      toAccountName: rt.toAccountId ? accountMap.get(rt.toAccountId.toString()) : undefined
    }))

    // Sort by next due date
    enrichedTransactions.sort((a, b) => 
      new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    )

    return NextResponse.json({
      success: true,
      data: enrichedTransactions
    })
  } catch (error) {
    console.error('Error fetching recurring transactions:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch recurring transactions' 
      },
      { status: 500 }
    )
  }
}

// POST /api/recurring-transactions - Create new recurring transaction
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate required fields (category not required if split)
    const requiredFields = body.isSplit 
      ? ['type', 'amount', 'currency', 'accountId', 'description', 'frequency', 'startDate']
      : ['type', 'amount', 'currency', 'accountId', 'category', 'description', 'frequency', 'startDate']
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Convert loan_payment to transfer with split enabled
    // Loan payments are stored as transfers (principal goes to loan account)
    // with auto-calculated split parts for principal (transfer) + interest (expense)
    let actualType = body.type
    let isSplit = body.isSplit || false
    
    if (body.type === 'loan_payment') {
      actualType = 'transfer'
      isSplit = true
      
      // Validate loan details are provided
      if (!body.loanDetails) {
        return NextResponse.json(
          { success: false, error: 'Loan payment requires loan details (originalAmount, interestRate, termMonths, startDate)' },
          { status: 400 }
        )
      }
      
      const { originalAmount, interestRate, termMonths, startDate } = body.loanDetails
      
      if (!originalAmount || !interestRate || !termMonths || !startDate) {
        return NextResponse.json(
          { success: false, error: 'Loan details must include originalAmount, interestRate, termMonths, and startDate' },
          { status: 400 }
        )
      }
      
      if (originalAmount <= 0 || termMonths <= 0 || interestRate < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid loan details: amounts must be positive' },
          { status: 400 }
        )
      }
      
      // Validate toAccountId is provided (loan account)
      if (!body.toAccountId) {
        return NextResponse.json(
          { success: false, error: 'Loan payment requires toAccountId (loan account)' },
          { status: 400 }
        )
      }
    }

    // Validate type
    if (!['expense', 'income', 'transfer'].includes(actualType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Validate transfer has toAccountId (if not split)
    if (actualType === 'transfer' && !body.toAccountId && !isSplit) {
      return NextResponse.json(
        { success: false, error: 'Transfer requires toAccountId' },
        { status: 400 }
      )
    }

    // Validate split transactions (but not for loan payments - they're auto-calculated)
    if (isSplit && body.type !== 'loan_payment') {
      if (!body.splits || !Array.isArray(body.splits) || body.splits.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Split transaction requires at least one split part' },
          { status: 400 }
        )
      }

      // Validate each split part
      for (const split of body.splits) {
        if (!split.type || !split.amount || !split.category) {
          return NextResponse.json(
            { success: false, error: 'Each split part requires type, amount, and category' },
            { status: 400 }
          )
        }
        if (split.type === 'transfer' && !split.toAccountId) {
          return NextResponse.json(
            { success: false, error: 'Transfer split requires toAccountId' },
            { status: 400 }
          )
        }
      }

      // Validate total amount matches sum of splits
      const splitTotal = body.splits.reduce((sum: number, split: any) => sum + split.amount, 0)
      if (Math.abs(splitTotal - body.amount) > 0.01) {
        return NextResponse.json(
          { success: false, error: 'Split amounts must equal total amount' },
          { status: 400 }
        )
      }
    }

    // Validate custom frequency
    if (body.frequency === 'custom' && (!body.interval || !body.intervalUnit)) {
      return NextResponse.json(
        { success: false, error: 'Custom frequency requires interval and intervalUnit' },
        { status: 400 }
      )
    }

    const recurringCollection = await getCollection<RecurringTransaction>('recurring_transactions')

    const startDate = new Date(body.startDate)
    const nextDueDate = calculateInitialNextDueDate(
      startDate,
      body.frequency,
      body.interval,
      body.intervalUnit
    )

    const now = new Date()
    
    // For loan payments, fetch the current balance from the linked loan account
    let loanCurrentBalance = body.loanDetails?.originalAmount
    let calculatedEndDate = body.endDate ? new Date(body.endDate) : undefined
    
    if (body.type === 'loan_payment' && body.toAccountId && body.loanDetails) {
      const { getCollection: getAccountCollection } = await import('@/lib/database')
      const accountsCollection = await getAccountCollection('accounts')
      const loanAccount = await accountsCollection.findOne({
        _id: new ObjectId(body.toAccountId),
        userId: user._id
      })
      if (loanAccount) {
        loanCurrentBalance = Math.abs(loanAccount.balance) // Use absolute value since loan accounts might be negative
      }
      
      // Calculate end date based on loan term (loan start date + term months)
      const loanStartDate = new Date(body.loanDetails.startDate)
      const loanEndDate = new Date(loanStartDate)
      loanEndDate.setMonth(loanEndDate.getMonth() + body.loanDetails.termMonths)
      
      // Use calculated end date if no end date provided
      if (!calculatedEndDate) {
        calculatedEndDate = loanEndDate
      }
    }
    
    const newRecurringTransaction: Omit<RecurringTransaction, '_id'> = {
      userId: user._id,
      type: actualType,
      amount: body.amount,
      currency: body.currency,
      accountId: new ObjectId(body.accountId),
      toAccountId: body.toAccountId ? new ObjectId(body.toAccountId) : undefined,
      category: body.category,
      subcategory: body.subcategory,
      description: body.description,
      notes: body.notes,
      isSplit: isSplit,
      splits: isSplit && body.splits ? body.splits.map((split: any) => ({
        type: split.type,
        amount: split.amount,
        category: split.category,
        toAccountId: split.toAccountId ? new ObjectId(split.toAccountId) : undefined,
        description: split.description
      })) : undefined,
      loanDetails: body.loanDetails ? {
        originalAmount: body.loanDetails.originalAmount,
        interestRate: body.loanDetails.interestRate,
        termMonths: body.loanDetails.termMonths,
        startDate: new Date(body.loanDetails.startDate),
        currentBalance: loanCurrentBalance, // Use actual loan account balance
        lastCalculatedAt: now
      } : undefined,
      frequency: body.frequency,
      interval: body.interval,
      intervalUnit: body.intervalUnit,
      startDate,
      nextDueDate,
      endDate: calculatedEndDate,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }

    const result = await recurringCollection.insertOne(newRecurringTransaction as RecurringTransaction)
    const created = await recurringCollection.findOne({ _id: result.insertedId })

    return NextResponse.json({
      success: true,
      data: created
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating recurring transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create recurring transaction' 
      },
      { status: 500 }
    )
  }
}
