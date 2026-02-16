'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AuthUser } from '@/lib/auth'
import { Account, Transaction } from '@/lib/types'
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
  Bitcoin,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus
} from 'lucide-react'
import { motion } from 'framer-motion'
import { AccountType } from '@/lib/types'
import { toast } from 'sonner'
import { TransactionFormModal, TransactionFormData } from '@/components/transactions/transaction-form-modal'
import { TransactionListItem } from '@/components/transactions/transaction-list-item'

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
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [calculatedBalance, setCalculatedBalance] = useState(0)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const hasCheckedRef = useRef(false)

  const fetchAccount = async () => {
    try {
      const accountResponse = await fetch(`/api/accounts/${resolvedParams.id}`)
      const accountData = await accountResponse.json()

      if (accountData.success) {
        setAccount(accountData.data)
      } else {
        toast.error('Failed to load account')
      }
    } catch (error) {
      console.error('Error fetching account:', error)
      toast.error('Failed to load account')
    }
  }

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
          // Fetch transactions after account is loaded
          fetchTransactions(resolvedParams.id)
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

  const fetchTransactions = async (accountId: string) => {
    setLoadingTransactions(true)
    try {
      const response = await fetch(`/api/transactions?accountId=${accountId}&limit=100&sortBy=date&sortOrder=desc`)
      const data = await response.json()
      
      if (data.success) {
        const txs = data.data.transactions || []
        
        // Fetch account details for transfers (including inactive accounts for proper names)
        const accountsResponse = await fetch('/api/accounts?includeInactive=true')
        const accountsData = await accountsResponse.json()
        const allAccounts = accountsData.success ? accountsData.data.accounts : []
        
        // Store accounts for later use
        setAccounts(allAccounts)
        
        // Enrich transactions with toAccount name
        const enrichedTxs = txs.map((t: Transaction) => {
          if (t.toAccountId) {
            const toAccount = allAccounts.find((a: Account) => a._id.toString() === t.toAccountId?.toString())
            return { ...t, toAccountName: toAccount?.name }
          }
          return t
        })
        
        setTransactions(enrichedTxs)
        
        // Calculate totals
        const income = txs
          .filter((t: Transaction) => t.type === 'income')
          .reduce((sum: number, t: Transaction) => sum + t.amount, 0)
        const expenses = txs
          .filter((t: Transaction) => t.type === 'expense')
          .reduce((sum: number, t: Transaction) => sum + t.amount, 0)
        
        // Use running balance from the most recent transaction (first in desc order)
        // This is more accurate than calculating from limited transaction set
        const balance = txs.length > 0 && txs[0].runningBalance !== undefined 
          ? txs[0].runningBalance 
          : 0
        
        setTotalIncome(income)
        setTotalExpenses(expenses)
        setCalculatedBalance(balance)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setLoadingTransactions(false)
    }
  }

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

  const handleAddTransaction = () => {
    setSelectedTransaction(null)
    setShowTransactionModal(true)
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setShowTransactionModal(true)
  }

  const handleDeleteTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmitTransaction = async (data: TransactionFormData) => {
    try {
      const url = selectedTransaction
        ? `/api/transactions/${selectedTransaction._id}`
        : '/api/transactions'
      
      const method = selectedTransaction ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        toast.success(selectedTransaction ? 'Transaction updated successfully' : 'Transaction created successfully')
        setShowTransactionModal(false)
        
        // Refresh transactions and account data
        await fetchTransactions(resolvedParams.id)
        await fetchAccount()
      } else {
        toast.error(result.error || 'Failed to save transaction')
      }
    } catch (error) {
      console.error('Error saving transaction:', error)
      toast.error('Failed to save transaction')
    }
  }

  const confirmDelete = async () => {
    if (!selectedTransaction) return

    try {
      const response = await fetch(`/api/transactions/${selectedTransaction._id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Transaction deleted successfully')
        setIsDeleteDialogOpen(false)
        
        // Refresh transactions and account data
        await fetchTransactions(resolvedParams.id)
        await fetchAccount()
      } else {
        toast.error(data.error || 'Failed to delete transaction')
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
      toast.error('Failed to delete transaction')
    }
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
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAddTransaction}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600"
            >
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="gap-2"
            >
              <Edit2 className="h-4 w-4" />
              Edit Account
            </Button>
          </div>
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
                    {formatCurrency(calculatedBalance, account.currency)}
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
                  {formatCurrency(totalIncome, account.currency)}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {transactions.filter(t => t.type === 'income').length} transactions
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
                  {formatCurrency(totalExpenses, account.currency)}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {transactions.filter(t => t.type === 'expense').length} transactions
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
                <div className="text-2xl font-bold">{transactions.length}</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Total transactions
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
              {loadingTransactions ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No transactions yet
                  </p>
                  <Button onClick={() => router.push('/dashboard/transactions')}>
                    Add Transaction
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <TransactionListItem
                      key={transaction._id.toString()}
                      transaction={transaction}
                      accountName={account.name}
                      toAccountName={transaction.toAccountName}
                      onEdit={handleEditTransaction}
                      onDelete={handleDeleteTransaction}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Transaction Form Modal */}
      <TransactionFormModal
        open={showTransactionModal}
        onOpenChange={setShowTransactionModal}
        transaction={selectedTransaction}
        accounts={accounts}
        onSubmit={handleSubmitTransaction}
        defaultAccountId={account._id.toString()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone and will revert the balance changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
