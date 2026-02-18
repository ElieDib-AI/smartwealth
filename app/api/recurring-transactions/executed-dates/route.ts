import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { connectToDatabase } from '@/lib/database'
import { ObjectId } from 'mongodb'

/**
 * GET /api/recurring-transactions/executed-dates
 * Returns a map of recurringId -> array of executed dates
 * This is much more efficient than querying for each recurring transaction individually
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { db } = await connectToDatabase()
    const transactionsCollection = db.collection('transactions')

    // Aggregate all executed transactions grouped by recurringId
    // Use recurringDueDate if available (tracks which occurrence was executed),
    // otherwise fall back to date for backward compatibility
    const executedDates = await transactionsCollection
      .aggregate([
        {
          $match: {
            userId: new ObjectId(user.id),
            recurringId: { $exists: true, $ne: null },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: '$recurringId',
            dates: { 
              $addToSet: {
                $ifNull: ['$recurringDueDate', '$date']
              }
            }
          }
        }
      ])
      .toArray()

    // Convert to a more usable format: { recurringId: [date1, date2, ...] }
    const executedMap: Record<string, string[]> = {}
    
    executedDates.forEach((item) => {
      const recurringId = item._id.toString()
      executedMap[recurringId] = item.dates.map((date: Date) => new Date(date).toISOString())
    })

    return NextResponse.json({
      success: true,
      data: executedMap
    })
  } catch (error) {
    console.error('Error fetching executed dates:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch executed dates' },
      { status: 500 }
    )
  }
}
