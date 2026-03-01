import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { AssetPrice } from '@/lib/types'

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
    const symbol = `${from}/${to}`

    // Fetch from DB cache only (no Alpha Vantage call)
    const pricesCollection = await getCollection<AssetPrice>('asset_prices')
    const cachedPrice = await pricesCollection.findOne({
      symbol: symbol.toUpperCase(),
      assetType: 'forex'
    })

    if (!cachedPrice) {
      return NextResponse.json(
        { success: false, error: 'No cached forex rate found. Click "Refresh Prices" to fetch from Alpha Vantage.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: cachedPrice.symbol,
        price: cachedPrice.price,
        currency: cachedPrice.currency,
        lastUpdated: cachedPrice.lastUpdated
      }
    })
  } catch (error) {
    console.error('Error fetching cached forex rate:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch cached forex rate'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
