import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { connectToDatabase } from '@/lib/database'
import { ObjectId } from 'mongodb'

/**
 * POST /api/recurring-transactions/[id]/skip-date
 * Skip a specific occurrence date for a recurring transaction
 */
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
    const body = await request.json()
    const { date } = body

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Date is required' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const recurringCollection = db.collection('recurring_transactions')

    // Verify the recurring transaction exists and belongs to the user
    const recurringTx = await recurringCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(user.id)
    })

    if (!recurringTx) {
      return NextResponse.json(
        { success: false, error: 'Recurring transaction not found' },
        { status: 404 }
      )
    }

    // Parse the date and ensure it's a valid Date object
    const skipDate = new Date(date)
    if (isNaN(skipDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Add the date to skippedDates array (using $addToSet to avoid duplicates)
    const result = await recurringCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $addToSet: { skippedDates: skipDate },
        $set: { updatedAt: new Date() }
      }
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to skip date' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Date skipped successfully'
    })
  } catch (error) {
    console.error('Error skipping date:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to skip date' },
      { status: 500 }
    )
  }
}
