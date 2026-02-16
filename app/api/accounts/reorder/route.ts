import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { Account } from '@/lib/types'

// POST /api/accounts/reorder - Update account display order
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
    const { accountIds } = body

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid account IDs array' },
        { status: 400 }
      )
    }

    // Validate all IDs are valid ObjectIds
    for (const id of accountIds) {
      if (!ObjectId.isValid(id)) {
        return NextResponse.json(
          { success: false, error: `Invalid account ID: ${id}` },
          { status: 400 }
        )
      }
    }

    const accountsCollection = await getCollection<Account>('accounts')

    // Update displayOrder for each account
    const updatePromises = accountIds.map((id: string, index: number) => {
      return accountsCollection.updateOne(
        { 
          _id: new ObjectId(id),
          userId: user._id
        },
        { 
          $set: { 
            displayOrder: index,
            updatedAt: new Date()
          } 
        }
      )
    })

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      message: 'Account order updated successfully'
    })
  } catch (error) {
    console.error('Error updating account order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update account order' },
      { status: 500 }
    )
  }
}
