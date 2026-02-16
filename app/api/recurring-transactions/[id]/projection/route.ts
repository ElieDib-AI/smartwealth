import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { RecurringTransaction } from '@/lib/types'
import { generateAmortizationSchedule, calculatePaymentsMade } from '@/lib/utils/loan-calculator'

// GET /api/recurring-transactions/[id]/projection - Get loan payment projections
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

    // Get query params
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '12')

    if (months <= 0 || months > 360) {
      return NextResponse.json(
        { success: false, error: 'Months must be between 1 and 360' },
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

    // Generate full amortization schedule
    const fullSchedule = generateAmortizationSchedule(
      recurringTx.loanDetails.originalAmount,
      recurringTx.loanDetails.interestRate,
      recurringTx.loanDetails.termMonths,
      recurringTx.loanDetails.startDate
    )

    // Calculate how many payments have been made
    const paymentsMade = calculatePaymentsMade(
      recurringTx.loanDetails.startDate,
      recurringTx.lastExecutedAt || new Date()
    )

    // Get future projections (next N months)
    const futurePayments = fullSchedule.slice(paymentsMade, paymentsMade + months)

    // Calculate totals for the projection period
    const totalPrincipal = futurePayments.reduce((sum, p) => sum + p.principal, 0)
    const totalInterest = futurePayments.reduce((sum, p) => sum + p.interest, 0)
    const totalPayments = futurePayments.reduce((sum, p) => sum + p.totalPayment, 0)

    // Calculate overall loan statistics
    const currentBalance = recurringTx.loanDetails.currentBalance || recurringTx.loanDetails.originalAmount
    const totalPaid = recurringTx.loanDetails.originalAmount - currentBalance
    const percentComplete = (totalPaid / recurringTx.loanDetails.originalAmount) * 100
    const remainingPayments = recurringTx.loanDetails.termMonths - paymentsMade

    return NextResponse.json({
      success: true,
      data: {
        projections: futurePayments,
        summary: {
          totalPrincipal,
          totalInterest,
          totalPayments,
          averageMonthlyPayment: totalPayments / futurePayments.length
        },
        loanStatus: {
          originalAmount: recurringTx.loanDetails.originalAmount,
          currentBalance,
          totalPaid,
          percentComplete,
          paymentsMade,
          remainingPayments,
          totalPayments: recurringTx.loanDetails.termMonths
        }
      }
    })
  } catch (error) {
    console.error('Error generating loan projection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate loan projection' },
      { status: 500 }
    )
  }
}
