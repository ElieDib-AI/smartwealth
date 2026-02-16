import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { RecurringTransaction } from '@/lib/types'
import { getNextPaymentBreakdown, calculatePaymentsMade } from '@/lib/utils/loan-calculator'

// POST /api/recurring-transactions/[id]/calculate-split - Calculate loan payment split
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

    const recurringCollection = await getCollection<RecurringTransaction>('recurring_transactions')
    
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

    // Validate this is a loan payment
    if (!recurringTx.loanDetails) {
      return NextResponse.json(
        { success: false, error: 'This is not a loan payment transaction' },
        { status: 400 }
      )
    }

    // Calculate the next payment breakdown
    const breakdown = getNextPaymentBreakdown(
      recurringTx.loanDetails,
      recurringTx.lastExecutedAt
    )

    // Calculate how many payments have been made
    const paymentsMade = calculatePaymentsMade(
      recurringTx.loanDetails.startDate,
      recurringTx.lastExecutedAt || new Date()
    )

    return NextResponse.json({
      success: true,
      data: {
        breakdown,
        paymentsMade,
        totalPayments: recurringTx.loanDetails.termMonths,
        percentComplete: (paymentsMade / recurringTx.loanDetails.termMonths) * 100
      }
    })
  } catch (error) {
    console.error('Error calculating loan split:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to calculate loan split' },
      { status: 500 }
    )
  }
}
