'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthUser } from '@/lib/auth'
import { Account } from '@/lib/types'
import { 
  ArrowLeft, 
  Edit2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Calendar,
  Building2,
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  Home,
  Car,
  Gem,
  Package,
  LineChart,
  Bitcoin
} from 'lucide-react'
import { motion } from 'framer-motion'
import { AccountType } from '@/lib/types'

const accountIcons: Record<AccountType, typeof Wallet> = {
  // Bank Accounts
  checking: Wallet,
  savings: PiggyBank,
  cash: Banknote,
  // Credit & Loans
  credit_card: CreditCard,
  personal_loan: Banknote,
  mortgage: Home,
  car_loan: Car,
  student_loan: Package,
  // Investments
  stocks: LineChart,
  retirement: PiggyBank,
  crypto: Bitcoin,
  mutual_funds: TrendingUp,
  // Assets
  real_estate: Home,
  vehicle: Car,
  valuables: Gem,
  other_assets: Package
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true
    
    const checkAuthAndFetchAccount = async () => {
      try {
        // Check authentication
        const authResponse = await fetch('/api/auth/session')
        const authData = await authResponse.json()

        if (!authData.success || !authData.user) {
          router.push('/login')
          return
        }

        setUser(authData.user)

        // Fetch account details
        const accountResponse = await fetch(`/api/accounts/${resolvedParams.id}`)
        const accountData = await accountResponse.json()

        if (accountData.success) {
          setAccount(accountData.data)
        } else {
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Error:', error)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndFetchAccount()
  }, [router, resolvedParams.id])

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date))
  }

  if (loading || !user || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading account...</p>
        </div>
      </div>
    )
  }

  const Icon = accountIcons[account.type] || Wallet

  return (
    <DashboardLayout user={user}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{account.name}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {account.type.charAt(0).toUpperCase() + account.type.slice(1)} Account
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/dashboard')}
            className="gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Edit Account
          </Button>
        </div>

        {/* Account Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-primary-600 to-primary-500 text-white border-0">
            <CardContent className="p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-2">Current Balance</p>
                  <h2 className="text-4xl font-bold mb-4">
                    {formatCurrency(account.balance, account.currency)}
                  </h2>
                  <div className="flex items-center gap-4 text-sm opacity-90">
                    {account.institution && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {account.institution}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Created {formatDate(account.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Icon className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Statistics Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Income
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(0, account.currency)}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  No transactions yet
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Expenses
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(0, account.currency)}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  No transactions yet
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Transactions
                </CardTitle>
                <DollarSign className="h-4 w-4 text-primary-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  No transactions yet
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest account activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No transactions yet
                </p>
                <Button onClick={() => router.push('/dashboard/transactions')}>
                  Add Transaction
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
