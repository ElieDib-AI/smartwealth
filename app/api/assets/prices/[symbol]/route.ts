import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { AlphaVantageService } from '@/lib/services/alpha-vantage-service'

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

    let priceData: { price: number; currency: string }

    switch (assetType) {
      case 'stock':
        priceData = await AlphaVantageService.fetchStockPrice(symbol)
        break
      case 'metal':
        if (!['XAU', 'XAG', 'XPT', 'XPD'].includes(symbol)) {
          return NextResponse.json(
            { success: false, error: 'Invalid metal symbol. Use XAU, XAG, XPT, or XPD' },
            { status: 400 }
          )
        }
        priceData = await AlphaVantageService.fetchMetalPrice(symbol as 'XAU' | 'XAG' | 'XPT' | 'XPD')
        break
      case 'forex':
        const [from, to] = symbol.split('/')
        if (!from || !to) {
          return NextResponse.json(
            { success: false, error: 'Forex symbol must be in format FROM/TO (e.g., USD/AED)' },
            { status: 400 }
          )
        }
        priceData = await AlphaVantageService.fetchForexRate(from, to)
        break
      case 'crypto':
        const [crypto, market] = symbol.split('/')
        if (!crypto) {
          return NextResponse.json(
            { success: false, error: 'Crypto symbol must be in format CRYPTO/MARKET (e.g., BTC/USD)' },
            { status: 400 }
          )
        }
        priceData = await AlphaVantageService.fetchCryptoPrice(crypto, market || 'USD')
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid asset type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        assetType,
        ...priceData,
        remainingApiCalls: AlphaVantageService.getRemainingCalls()
      }
    })
  } catch (error) {
    console.error('Error fetching price:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch price'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
