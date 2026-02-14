import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { Account } from '@/lib/types'
import { ObjectId } from 'mongodb'

// GET /api/accounts/[id] - Get single account
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
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const accountsCollection = await getCollection<Account>('accounts')
    
    const account = await accountsCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id,
      isActive: true
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: account
    })
  } catch (error) {
    console.error('Error fetching account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}

// PUT /api/accounts/[id] - Update account
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
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, type, balance, currency, institution, color, icon } = body

    // Validation
    if (!name || !type || balance === undefined || !currency || !color || !icon) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Account name must be 50 characters or less' },
        { status: 400 }
      )
    }

    const validTypes = ['checking', 'savings', 'credit', 'investment', 'cash']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account type' },
        { status: 400 }
      )
    }

    if (typeof balance !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Balance must be a number' },
        { status: 400 }
      )
    }

    const accountsCollection = await getCollection<Account>('accounts')
    
    // Verify ownership
    const existingAccount = await accountsCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    })

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    const updateData = {
      name: name.trim(),
      type,
      balance,
      currency,
      institution: institution?.trim() || undefined,
      color,
      icon,
      updatedAt: new Date()
    }

    await accountsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    const updatedAccount = await accountsCollection.findOne({ _id: new ObjectId(id) })

    return NextResponse.json({
      success: true,
      data: updatedAccount
    })
  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update account' },
      { status: 500 }
    )
  }
}

// DELETE /api/accounts/[id] - Delete account (soft delete)
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
        { success: false, error: 'Invalid account ID' },
        { status: 400 }
      )
    }

    const accountsCollection = await getCollection<Account>('accounts')
    
    // Verify ownership
    const existingAccount = await accountsCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    })

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // Soft delete - set isActive to false
    await accountsCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          isActive: false,
          updatedAt: new Date()
        } 
      }
    )

    return NextResponse.json({
      success: true,
      data: { message: 'Account deleted successfully' }
    })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
