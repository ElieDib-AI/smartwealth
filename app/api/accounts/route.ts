import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { Account } from '@/lib/types'
import { ObjectId } from 'mongodb'

// GET /api/accounts - List all accounts for authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const accountsCollection = await getCollection<Account>('accounts')
    
    const accounts = await accountsCollection
      .find({ 
        userId: user._id,
        isActive: true 
      })
      .sort({ createdAt: -1 })
      .toArray()

    // Calculate total balance
    const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        totalBalance
      }
    })
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

// POST /api/accounts - Create new account
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
    
    const now = new Date()
    const newAccount: Omit<Account, '_id'> = {
      userId: user._id,
      name: name.trim(),
      type,
      balance,
      currency,
      institution: institution?.trim() || undefined,
      color,
      icon,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }

    const result = await accountsCollection.insertOne(newAccount as Account)

    const createdAccount = await accountsCollection.findOne({ _id: result.insertedId })

    return NextResponse.json({
      success: true,
      data: createdAccount
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
