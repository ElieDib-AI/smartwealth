import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { AssetHolding } from '@/lib/types'

export async function PUT(
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
        { success: false, error: 'Invalid holding ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { quantity, purchasePrice, purchaseDate, notes } = body

    const holdingsCollection = await getCollection<AssetHolding>('asset_holdings')

    const existing = await holdingsCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Holding not found' },
        { status: 404 }
      )
    }

    const updates: Partial<AssetHolding> = {
      updatedAt: new Date()
    }

    if (quantity !== undefined) {
      if (typeof quantity !== 'number' || quantity <= 0) {
        return NextResponse.json(
          { success: false, error: 'Valid quantity (> 0) is required' },
          { status: 400 }
        )
      }
      updates.quantity = quantity
    }

    if (purchasePrice !== undefined) {
      updates.purchasePrice = purchasePrice || undefined
    }

    if (purchaseDate !== undefined) {
      updates.purchaseDate = purchaseDate ? new Date(purchaseDate) : undefined
    }

    if (notes !== undefined) {
      updates.notes = notes || undefined
    }

    await holdingsCollection.updateOne(
      { _id: new ObjectId(id), userId: user._id },
      { $set: updates }
    )

    const updated = await holdingsCollection.findOne({ _id: new ObjectId(id) })

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating holding:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update holding' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
        { success: false, error: 'Invalid holding ID' },
        { status: 400 }
      )
    }

    const holdingsCollection = await getCollection<AssetHolding>('asset_holdings')

    const result = await holdingsCollection.deleteOne({
      _id: new ObjectId(id),
      userId: user._id
    })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Holding not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { deletedId: id }
    })
  } catch (error) {
    console.error('Error deleting holding:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete holding' },
      { status: 500 }
    )
  }
}
