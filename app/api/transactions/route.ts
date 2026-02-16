import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { TransactionService } from '@/lib/services/transaction-service'
import { TransactionType } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const type = searchParams.get('type') as TransactionType | null
    const category = searchParams.get('category')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status') as 'completed' | 'pending' | 'cancelled' | null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Build filters
    const filters: {
      accountId?: ObjectId
      type?: TransactionType
      category?: string
      startDate?: Date
      endDate?: Date
      status?: 'completed' | 'pending' | 'cancelled'
    } = {}

    if (accountId) {
      filters.accountId = new ObjectId(accountId)
    }
    if (type && ['expense', 'income', 'transfer'].includes(type)) {
      filters.type = type
    }
    if (category) {
      filters.category = category
    }
    if (startDate) {
      filters.startDate = new Date(startDate)
    }
    if (endDate) {
      filters.endDate = new Date(endDate)
    }
    if (status) {
      filters.status = status
    }

    // Get transactions
    const result = await TransactionService.listTransactions(
      new ObjectId(user.id),
      filters,
      { page, limit, sortBy, sortOrder }
    )

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch transactions' 
      },
      { status: 500 }
    )
  }
}

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

    // Validate required fields (category not required for transfers)
    const requiredFields = ['type', 'amount', 'currency', 'accountId', 'description', 'date']
    if (body.type !== 'transfer') {
      requiredFields.push('category')
    }
    
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // Validate transaction type
    if (!['expense', 'income', 'transfer'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Validate amount
    if (typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Validate transfer requires toAccountId
    if (body.type === 'transfer' && !body.toAccountId) {
      return NextResponse.json(
        { success: false, error: 'Transfer requires destination account (toAccountId)' },
        { status: 400 }
      )
    }

    // Validate date
    const transactionDate = new Date(body.date)
    if (isNaN(transactionDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Create transaction
    const transaction = await TransactionService.createTransaction({
      userId: new ObjectId(user.id),
      type: body.type,
      amount: body.amount,
      currency: body.currency,
      accountId: new ObjectId(body.accountId),
      toAccountId: body.toAccountId ? new ObjectId(body.toAccountId) : undefined,
      category: body.category,
      subcategory: body.subcategory,
      description: body.description,
      notes: body.notes,
      tags: body.tags,
      date: transactionDate,
      status: body.status || 'completed',
      currencyConversion: body.currencyConversion
    })

    return NextResponse.json({
      success: true,
      data: transaction
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create transaction' 
      },
      { status: 500 }
    )
  }
}
