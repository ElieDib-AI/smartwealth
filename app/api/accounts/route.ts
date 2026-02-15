import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCollection } from '@/lib/database'
import { Account, Transaction } from '@/lib/types'
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
    
    // Check if we should include inactive accounts (for transaction enrichment)
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    
    const query: any = { userId: user._id }
    if (!includeInactive) {
      query.isActive = true
    }
    
    const accounts = await accountsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    // Get transactions collection to get latest running balance
    const transactionsCollection = await getCollection<Transaction>('transactions')
    
    // Use aggregation to get latest transaction for each account in one query
    const latestTransactions = await transactionsCollection.aggregate([
      {
        $match: {
          userId: user._id,
          accountId: { $in: accounts.map(a => a._id) }
        }
      },
      {
        $sort: { accountId: 1, date: -1, createdAt: -1, _id: -1 }
      },
      {
        $group: {
          _id: '$accountId',
          runningBalance: { $first: '$runningBalance' }
        }
      }
    ]).toArray()
    
    // Create a map for quick lookup
    const balanceMap = new Map(
      latestTransactions.map(tx => [tx._id.toString(), tx.runningBalance ?? 0])
    )
    
    // Apply balances to accounts
    const accountsWithCalculatedBalance = accounts.map(account => ({
      ...account,
      balance: balanceMap.get(account._id.toString()) ?? 0
    }))

    // Calculate total balance (convert all to USD)
    const EXCHANGE_RATES: Record<string, number> = {
      AED: 3.6775,
      EUR: 0.8414,
      USD: 1.0,
      LBP: 89500
    }
    
    const totalBalance = accountsWithCalculatedBalance.reduce((sum, account) => {
      const rate = EXCHANGE_RATES[account.currency] || 1
      const usdValue = account.balance / rate
      return sum + usdValue
    }, 0)

    return NextResponse.json({
      success: true,
      data: {
        accounts: accountsWithCalculatedBalance,
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
    const { name, type, category, balance, currency, institution, color, icon } = body

    // Validation
    if (!name || !type || !category || balance === undefined || !currency || !color || !icon) {
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

    const validTypes = [
      'checking', 'savings', 'cash',
      'credit_card', 'personal_loan', 'mortgage', 'car_loan', 'student_loan',
      'stocks', 'retirement', 'crypto', 'mutual_funds',
      'real_estate', 'vehicle', 'valuables', 'other_assets'
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account type' },
        { status: 400 }
      )
    }

    const validCategories = ['bank', 'credit_loans', 'investments', 'assets']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid account category' },
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
      category,
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
