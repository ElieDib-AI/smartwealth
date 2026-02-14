'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { Transaction, Account } from '@/lib/types'
import { TransactionListItem } from '@/components/transactions/transaction-list-item'
import { TransactionFilters, FilterValues } from '@/components/transactions/transaction-filters'
import { TransactionFormModal, TransactionFormData } from '@/components/transactions/transaction-form-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { AuthUser } from '@/lib/auth'
import { toast } from 'sonner'

export default function TransactionsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const hasCheckedRef = useRef(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

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
          setAuthLoading(false)
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

  useEffect(() => {
    if (user) {
      fetchAccounts()
      fetchCategories()
    }
  }, [user])

  useEffect(() => {
    fetchTransactions()
  }, [filters, page])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      if (data.success) {
        setAccounts(data.data)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Failed to load accounts')
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (data.success) {
        const allCategories = [
          ...data.data.predefined.expense.map((c: { name: string }) => c.name),
          ...data.data.predefined.income.map((c: { name: string }) => c.name),
          ...data.data.custom.map((c: { name: string }) => c.name)
        ]
        setCategories(allCategories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.accountId && { accountId: filters.accountId }),
        ...(filters.type && { type: filters.type }),
        ...(filters.category && { category: filters.category }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      })

      const response = await fetch(`/api/transactions?${params}`)
      const data = await response.json()
      
      if (data.success) {
        let filteredTransactions = data.data.transactions

        // Client-side search filter (since API doesn't support it yet)
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          filteredTransactions = filteredTransactions.filter((t: Transaction) =>
            t.description.toLowerCase().includes(searchLower) ||
            t.notes?.toLowerCase().includes(searchLower) ||
            t.category.toLowerCase().includes(searchLower)
          )
        }

        setTransactions(filteredTransactions)
        setTotal(data.data.total)
        setTotalPages(data.data.totalPages)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters)
    setPage(1) // Reset to first page when filters change
  }

  const handleAddTransaction = () => {
    setSelectedTransaction(null)
    setIsFormOpen(true)
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsFormOpen(true)
  }

  const handleDeleteTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsDeleteDialogOpen(true)
  }

  const handleSubmitTransaction = async (formData: TransactionFormData) => {
    try {
      const url = selectedTransaction
        ? `/api/transactions/${selectedTransaction._id}`
        : '/api/transactions'
      
      const method = selectedTransaction ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        toast.success(selectedTransaction ? 'Transaction updated successfully' : 'Transaction added successfully')
        fetchTransactions()
        fetchAccounts() // Refresh accounts to update balances
        setIsFormOpen(false)
      } else {
        toast.error(data.error || 'Failed to save transaction')
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
        fetchTransactions()
        fetchAccounts() // Refresh accounts to update balances
        setIsDeleteDialogOpen(false)
      } else {
        toast.error(data.error || 'Failed to delete transaction')
      }
    } catch (error) {
      console.error('Error deleting transaction:', error)
      toast.error('Failed to delete transaction')
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

  const calculateTotals = () => {
    const income = transactions
      .filter(t => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const expenses = transactions
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0)
    
    return { income, expenses, net: income - expenses }
  }

  const totals = calculateTotals()

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Transactions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your income, expenses, and transfers
          </p>
        </div>
        <Button onClick={handleAddTransaction}>
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Income</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {formatCurrency(totals.income, 'USD')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {formatCurrency(totals.expenses, 'USD')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Net</p>
          <p className={`text-2xl font-bold mt-1 ${
            totals.net >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(totals.net, 'USD')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <TransactionFilters
        accounts={accounts}
        categories={categories}
        onFilterChange={handleFilterChange}
      />

      {/* Transactions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
            <Button onClick={handleAddTransaction} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Transaction
            </Button>
          </div>
        ) : (
          <>
            {transactions.map((transaction) => (
              <TransactionListItem
                key={transaction._id.toString()}
                transaction={transaction}
                accountName={getAccountName(transaction.accountId.toString())}
                toAccountName={transaction.toAccountId ? getAccountName(transaction.toAccountId.toString()) : undefined}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} transactions
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Transaction Form Modal */}
      <TransactionFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        transaction={selectedTransaction}
        accounts={accounts}
        onSubmit={handleSubmitTransaction}
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
      </div>
    </DashboardLayout>
  )
}
