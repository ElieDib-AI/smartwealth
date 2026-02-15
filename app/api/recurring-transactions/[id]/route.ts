import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { RecurringTransaction } from '@/lib/types'
import { calculateNextDueDate } from '@/lib/utils/recurring'

// GET /api/recurring-transactions/[id] - Get single recurring transaction
export async function GET(
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

    const recurringCollection = await getCollection<RecurringTransaction>('recurring_transactions')
    
    const recurringTransaction = await recurringCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    })

    if (!recurringTransaction) {
      return NextResponse.json(
        { success: false, error: 'Recurring transaction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: recurringTransaction
    })
  } catch (error) {
    console.error('Error fetching recurring transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch recurring transaction' 
      },
      { status: 500 }
    )
  }
}

// PUT /api/recurring-transactions/[id] - Update recurring transaction
export async function PUT(
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

    const body = await request.json()

    // Validate type if provided
    if (body.type && !['expense', 'income', 'transfer'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Validate transfer has toAccountId
    if (body.type === 'transfer' && !body.toAccountId) {
      return NextResponse.json(
        { success: false, error: 'Transfer requires toAccountId' },
        { status: 400 }
      )
    }

    // Validate custom frequency
    if (body.frequency === 'custom' && (!body.interval || !body.intervalUnit)) {
      return NextResponse.json(
        { success: false, error: 'Custom frequency requires interval and intervalUnit' },
        { status: 400 }
      )
    }

    const recurringCollection = await getCollection<RecurringTransaction>('recurring_transactions')
    
    // Verify ownership
    const existing = await recurringCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Recurring transaction not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date()
    }

    if (body.type !== undefined) updateData.type = body.type
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.currency !== undefined) updateData.currency = body.currency
    if (body.accountId !== undefined) updateData.accountId = new ObjectId(body.accountId)
    if (body.toAccountId !== undefined) updateData.toAccountId = body.toAccountId ? new ObjectId(body.toAccountId) : null
    if (body.category !== undefined) updateData.category = body.category
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory
    if (body.description !== undefined) updateData.description = body.description
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.frequency !== undefined) updateData.frequency = body.frequency
    if (body.interval !== undefined) updateData.interval = body.interval
    if (body.intervalUnit !== undefined) updateData.intervalUnit = body.intervalUnit
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null

    // Recalculate nextDueDate if frequency changed
    if (body.frequency !== undefined || body.interval !== undefined || body.intervalUnit !== undefined) {
      const frequency = body.frequency || existing.frequency
      const interval = body.interval || existing.interval
      const intervalUnit = body.intervalUnit || existing.intervalUnit
      
      updateData.nextDueDate = calculateNextDueDate(
        existing.nextDueDate,
        frequency,
        interval,
        intervalUnit
      )
    }

    await recurringCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    const updated = await recurringCollection.findOne({ _id: new ObjectId(id) })

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating recurring transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update recurring transaction' 
      },
      { status: 500 }
    )
  }
}

// DELETE /api/recurring-transactions/[id] - Soft delete recurring transaction
export async function DELETE(
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

    const recurringCollection = await getCollection<RecurringTransaction>('recurring_transactions')
    
    // Verify ownership
    const existing = await recurringCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Recurring transaction not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false
    await recurringCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          isActive: false,
          updatedAt: new Date()
        } 
      }
    )

    return NextResponse.json({
      success: true,
      data: { message: 'Recurring transaction deleted successfully' }
    })
  } catch (error) {
    console.error('Error deleting recurring transaction:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete recurring transaction' 
      },
      { status: 500 }
    )
  }
}
