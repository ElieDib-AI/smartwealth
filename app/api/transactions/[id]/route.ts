import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { TransactionService } from '@/lib/services/transaction-service'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
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
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    const transaction = await TransactionService.getTransactionById(
      new ObjectId(id),
      new ObjectId(user.id)
    )

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: transaction
    })
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch transaction' 
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
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
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate amount if provided
    if (body.amount !== undefined) {
      if (typeof body.amount !== 'number' || body.amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Amount must be a positive number' },
          { status: 400 }
        )
      }
    }

    // Validate date if provided
    if (body.date !== undefined) {
      const transactionDate = new Date(body.date)
      if (isNaN(transactionDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format' },
          { status: 400 }
        )
      }
      body.date = transactionDate
    }

    // Convert ObjectIds if provided
    if (body.accountId) {
      body.accountId = new ObjectId(body.accountId)
    }
    if (body.toAccountId) {
      body.toAccountId = new ObjectId(body.toAccountId)
    }

    // Update transaction
    const transaction = await TransactionService.updateTransaction(
      new ObjectId(id),
      new ObjectId(user.id),
      body
    )

    return NextResponse.json({
      success: true,
      data: transaction
    })
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update transaction' 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
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
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      )
    }

    await TransactionService.deleteTransaction(
      new ObjectId(id),
      new ObjectId(user.id)
    )

    return NextResponse.json({
      success: true,
      data: { message: 'Transaction deleted successfully' }
    })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete transaction' 
      },
      { status: 500 }
    )
  }
}
