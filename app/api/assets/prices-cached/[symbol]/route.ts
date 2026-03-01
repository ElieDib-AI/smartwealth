import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { AssetPrice } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { symbol } = await params
    const { searchParams } = new URL(request.url)
    const assetType = searchParams.get('assetType') as 'stock' | 'metal' | 'forex' | 'crypto'

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol is required' },
        { status: 400 }
      )
    }

    if (!assetType || !['stock', 'metal', 'forex', 'crypto'].includes(assetType)) {
      return NextResponse.json(
        { success: false, error: 'Valid assetType is required (stock, metal, forex, crypto)' },
        { status: 400 }
      )
    }

    // Fetch from DB cache only (no Alpha Vantage call)
    const pricesCollection = await getCollection<AssetPrice>('asset_prices')
    const cachedPrice = await pricesCollection.findOne({
      symbol: symbol.toUpperCase(),
      assetType
    })

    if (!cachedPrice) {
      return NextResponse.json(
        { success: false, error: 'No cached price found. Click "Refresh Prices" to fetch from Alpha Vantage.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: cachedPrice.symbol,
        assetType: cachedPrice.assetType,
        price: cachedPrice.price,
        currency: cachedPrice.currency,
        lastUpdated: cachedPrice.lastUpdated
      }
    })
  } catch (error) {
    console.error('Error fetching cached price:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch cached price'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
