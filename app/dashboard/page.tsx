'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthUser } from '@/lib/auth'
import { Transaction, Account } from '@/lib/types'
import { TransactionListItem } from '@/components/transactions/transaction-list-item'
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const hasCheckedRef = useRef(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [accountTransactions, setAccountTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [calculatedBalance, setCalculatedBalance] = useState(0)

  // Check authentication
  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true
    
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()

        if (data.success && data.user) {
          setUser(data.user)
          setLoading(false)
        } else {
          router.push('/login')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  // Fetch accounts
  useEffect(() => {
    if (user) {
      fetchAccounts()
    }
  }, [user])

  // Fetch transactions when account is selected
  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountTransactions(selectedAccountId)
    }
  }, [selectedAccountId])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      if (data.success) {
        setAccounts(data.data.accounts || [])
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchAccountTransactions = async (accountId: string) => {
    setLoadingTransactions(true)
    try {
      const response = await fetch(`/api/transactions?accountId=${accountId}&limit=50&sortBy=date&sortOrder=desc`)
      const data = await response.json()
      
      if (data.success) {
        const txs = data.data.transactions || []
        
        // Fetch all accounts (including inactive) for proper transfer names
        const accountsResponse = await fetch('/api/accounts?includeInactive=true')
        const accountsData = await accountsResponse.json()
        const allAccounts = accountsData.success ? accountsData.data.accounts : []
        
        // Enrich transactions with toAccount name for transfers
        const enrichedTxs = txs.map((t: Transaction) => {
          if (t.toAccountId) {
            const toAccount = allAccounts.find((a: Account) => a._id.toString() === t.toAccountId?.toString())
            return { ...t, toAccountName: toAccount?.name }
          }
          return t
        })
        
        // Calculate balance from transactions
        let balance = 0
        for (const t of txs) {
          if (t.type === 'income') {
            balance += t.amount
          } else if (t.type === 'expense') {
            balance -= t.amount
          } else if (t.type === 'transfer') {
            if (t.transferDirection === 'in') {
              balance += t.amount
            } else if (t.transferDirection === 'out') {
              balance -= t.amount
            }
          }
        }
        
        setAccountTransactions(enrichedTxs)
        setCalculatedBalance(balance)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setLoadingTransactions(false)
    }
  }

  const getAccountName = (accountId: string): string => {
    const account = accounts.find(a => a._id.toString() === accountId)
    return account?.name || 'Unknown Account'
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  const selectedAccount = accounts.find(a => a._id.toString() === selectedAccountId)

  return (
    <DashboardLayout 
      user={user}
      onAccountClick={(accountId) => setSelectedAccountId(accountId)}
    >
      <div className="flex gap-6 h-full">
        {/* Main Content */}
        <div className={`flex-1 space-y-6 transition-all ${selectedAccountId ? 'max-w-2xl' : 'max-w-7xl mx-auto'}`}>
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user.name}!</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Click on any account in the sidebar to view its transactions
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Your template is ready to customize
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Start building your app by adding features to this dashboard.
                </p>
                <Button variant="outline" className="w-full">
                  View Documentation
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>
                  Manage your account settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Update your profile information and subscription.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.push('/profile')}
                >
                  Go to Profile
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upgrade</CardTitle>
                <CardDescription>
                  Unlock premium features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Get access to all premium features with our paid plan.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => router.push('/pricing')}
                >
                  View Pricing
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Account Transactions Panel */}
        {selectedAccountId && selectedAccount && (
          <div className="w-[500px] bg-white border-l border-gray-200 h-screen sticky top-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900">{selectedAccount.name}</h2>
                <button
                  onClick={() => setSelectedAccountId(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Balance:</span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(calculatedBalance, selectedAccount.currency)}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                {accountTransactions.length} transactions
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                </div>
              ) : accountTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No transactions found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accountTransactions.map((transaction) => {
                    const isTransfer = transaction.type === 'transfer'
                    
                    // For transfers: use the transferDirection field
                    const isTransferOut = isTransfer && transaction.transferDirection === 'out'
                    const isTransferIn = isTransfer && transaction.transferDirection === 'in'
                    
                    return (
                      <div
                        key={transaction._id.toString()}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {transaction.type === 'income' && (
                                <ArrowDownRight className="w-4 h-4 text-green-600" />
                              )}
                              {transaction.type === 'expense' && (
                                <ArrowUpRight className="w-4 h-4 text-red-600" />
                              )}
                              {transaction.type === 'transfer' && (
                                <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                              )}
                              <span className="font-medium text-gray-900">
                                {transaction.description}
                              </span>
                            </div>
                          <div className="text-sm text-gray-500">
                            {transaction.category}
                            {isTransferOut && transaction.toAccountName && (
                              <span className="text-blue-600"> • To {transaction.toAccountName}</span>
                            )}
                            {isTransferIn && transaction.toAccountName && (
                              <span className="text-blue-600"> • From {transaction.toAccountName}</span>
                            )}
                          </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(transaction.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </div>
                        <div className="text-right">
                          <div className={`font-semibold ${
                            transaction.amount === 0 ? 'text-blue-600' :
                            transaction.type === 'income' || isTransferIn ? 'text-green-600' : 
                            transaction.type === 'expense' || isTransferOut ? 'text-red-600' : 
                            'text-blue-600'
                          }`}>
                            {transaction.amount === 0 ? '' : (transaction.type === 'income' || isTransferIn) ? '+' : '-'}
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </div>
                          {transaction.runningBalance !== undefined && (
                            <div className="text-xs text-gray-400 mt-1">
                              Balance: {formatCurrency(transaction.runningBalance, transaction.currency)}
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
