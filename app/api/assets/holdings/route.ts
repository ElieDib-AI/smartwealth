import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { AssetHolding, AssetType } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId || !ObjectId.isValid(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Valid accountId is required' },
        { status: 400 }
      )
    }

    const holdingsCollection = await getCollection<AssetHolding>('asset_holdings')
    const holdings = await holdingsCollection
      .find({
        userId: user._id,
        accountId: new ObjectId(accountId)
      })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({
      success: true,
      data: holdings
    })
  } catch (error) {
    console.error('Error fetching holdings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch holdings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { accountId, symbol, assetType, quantity, displayCurrency, secondaryCurrency, purchasePrice, purchaseDate, notes, originalQuantity, originalUnit } = body

    if (!accountId || !ObjectId.isValid(accountId)) {
      return NextResponse.json(
        { success: false, error: 'Valid accountId is required' },
        { status: 400 }
      )
    }

    if (!symbol || typeof symbol !== 'string') {
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

    if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid quantity (> 0) is required' },
        { status: 400 }
      )
    }

    if (!displayCurrency || typeof displayCurrency !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Display currency is required' },
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
        { success: false, error: 'Holdings can only be added to investment accounts' },
        { status: 400 }
      )
    }

    const now = new Date()
    const newHolding: Omit<AssetHolding, '_id'> = {
      userId: user._id,
      accountId: new ObjectId(accountId),
      symbol: symbol.toUpperCase(),
      assetType: assetType as AssetType,
      quantity,
      displayCurrency,
      secondaryCurrency: secondaryCurrency || undefined,
      purchasePrice: purchasePrice || undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      notes: notes || undefined,
      originalQuantity: originalQuantity || undefined,
      originalUnit: originalUnit || undefined,
      createdAt: now,
      updatedAt: now
    }

    const holdingsCollection = await getCollection<AssetHolding>('asset_holdings')
    const result = await holdingsCollection.insertOne(newHolding as AssetHolding)

    const createdHolding = await holdingsCollection.findOne({ _id: result.insertedId })

    return NextResponse.json({
      success: true,
      data: createdHolding
    })
  } catch (error) {
    console.error('Error creating holding:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create holding' },
      { status: 500 }
    )
  }
}
