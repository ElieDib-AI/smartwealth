import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { AlphaVantageService } from '@/lib/services/alpha-vantage-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { accountId } = await params

    if (!ObjectId.isValid(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const accountsCollection = await getCollection('accounts')
    const account = await accountsCollection.findOne({
      _id: new ObjectId(accountId),
      userId: user._id
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    if (!['stocks', 'retirement', 'crypto', 'mutual_funds', 'precious_metals'].includes(account.type)) {
      return NextResponse.json(
        { success: false, error: 'Only investment accounts can sync prices' },
        { status: 400 }
      )
    }

    const result = await AlphaVantageService.syncAccountHoldings(
      user._id,
      new ObjectId(accountId)
    )

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        remainingApiCalls: AlphaVantageService.getRemainingCalls()
      }
    })
  } catch (error) {
    console.error('Error syncing account holdings:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync holdings'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
