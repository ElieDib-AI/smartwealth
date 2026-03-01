import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { AlphaVantageService } from '@/lib/services/alpha-vantage-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ from: string; to: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { from, to } = await params

    const result = await AlphaVantageService.fetchForexRate(from, to)

    return NextResponse.json({
      success: true,
      symbol: `${from}/${to}`,
      price: result.price,
      currency: to,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching forex rate:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch forex rate' },
      { status: 500 }
    )
  }
}
