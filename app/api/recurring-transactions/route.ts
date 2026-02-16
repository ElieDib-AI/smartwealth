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

    // Validate type
    if (!['expense', 'income', 'transfer'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Validate transfer has toAccountId (if not split)
    if (body.type === 'transfer' && !body.toAccountId && !body.isSplit) {
      return NextResponse.json(
        { success: false, error: 'Transfer requires toAccountId' },
        { status: 400 }
      )
    }

    // Validate split transactions
    if (body.isSplit) {
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
    const newRecurringTransaction: Omit<RecurringTransaction, '_id'> = {
      userId: user._id,
      type: body.type,
      amount: body.amount,
      currency: body.currency,
      accountId: new ObjectId(body.accountId),
      toAccountId: body.toAccountId ? new ObjectId(body.toAccountId) : undefined,
      category: body.category,
      subcategory: body.subcategory,
      description: body.description,
      notes: body.notes,
      isSplit: body.isSplit || false,
      splits: body.isSplit ? body.splits.map((split: any) => ({
        type: split.type,
        amount: split.amount,
        category: split.category,
        toAccountId: split.toAccountId ? new ObjectId(split.toAccountId) : undefined,
        description: split.description
      })) : undefined,
      frequency: body.frequency,
      interval: body.interval,
      intervalUnit: body.intervalUnit,
      startDate,
      nextDueDate,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
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
