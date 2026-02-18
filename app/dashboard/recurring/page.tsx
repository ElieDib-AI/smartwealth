'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AuthUser } from '@/lib/auth'
import { RecurringTransaction, Account } from '@/lib/types'
import { RecurringFormModal, RecurringFormData } from '@/components/recurring/recurring-form-modal'
import { RecurringListItem } from '@/components/recurring/recurring-list-item'
import { LoanExecutionDialog } from '@/components/recurring/loan-execution-dialog'
import { RecurringExecutionDialog } from '@/components/recurring/recurring-execution-dialog'
import { Plus, Repeat } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { generateOccurrences } from '@/lib/utils/recurring'
import { emitAccountUpdate } from '@/lib/events/account-events'

export default function RecurringTransactionsPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [recurringTransactions, setRecurringTransactions] = useState<(RecurringTransaction & { accountName?: string; toAccountName?: string })[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [executedDates, setExecutedDates] = useState<Map<string, Set<string>>>(new Map())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringTransaction | null>(null)
  const [loanExecutionRecurring, setLoanExecutionRecurring] = useState<RecurringTransaction | null>(null)
  const [loanBreakdown, setLoanBreakdown] = useState<any>(null)
  const [showLoanDialog, setShowLoanDialog] = useState(false)
  const [executionRecurring, setExecutionRecurring] = useState<RecurringTransaction & { accountName?: string; toAccountName?: string } | null>(null)
  const [executionDueDate, setExecutionDueDate] = useState<Date | null>(null)
  const [showExecutionDialog, setShowExecutionDialog] = useState(false)
  const [deleteRecurringId, setDeleteRecurringId] = useState<string | null>(null)
  const [deleteDueDate, setDeleteDueDate] = useState<Date | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true
    
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()

        if (data.success && data.user) {
          setUser(data.user)
          fetchData()
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

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch all data in parallel - much more efficient!
      const [recurringResponse, accountsResponse, executedDatesResponse] = await Promise.all([
        fetch('/api/recurring-transactions'),
        fetch('/api/accounts'),
        fetch('/api/recurring-transactions/executed-dates')
      ])

      const recurringData = await recurringResponse.json()
      const accountsData = await accountsResponse.json()
      const executedDatesData = await executedDatesResponse.json()

      if (recurringData.success) {
        setRecurringTransactions(recurringData.data)
      }

      if (accountsData.success) {
        setAccounts(accountsData.data.accounts || [])
      }

      if (executedDatesData.success) {
        // Convert the response object to a Map of Sets for efficient lookup
        const executedMap = new Map<string, Set<string>>()
        Object.entries(executedDatesData.data).forEach(([recurringId, dates]) => {
          executedMap.set(recurringId, new Set(dates as string[]))
        })
        setExecutedDates(executedMap)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load recurring transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRecurring = () => {
    setSelectedRecurring(null)
    setIsFormOpen(true)
  }

  const handleEditRecurring = (recurring: RecurringTransaction) => {
    setSelectedRecurring(recurring)
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (data: RecurringFormData) => {
    try {
      const url = selectedRecurring 
        ? `/api/recurring-transactions/${selectedRecurring._id.toString()}`
        : '/api/recurring-transactions'
      
      const method = selectedRecurring ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        toast.success(selectedRecurring ? 'Recurring transaction updated' : 'Recurring transaction created')
        fetchData()
        setIsFormOpen(false)
      } else {
        toast.error(result.error || 'Failed to save recurring transaction')
      }
    } catch (error) {
      console.error('Error saving recurring transaction:', error)
      toast.error('Failed to save recurring transaction')
    }
  }

  const handleExecute = async (id: string, dueDate: Date) => {
    // Find the recurring transaction
    const recurring = recurringTransactions.find(r => r._id.toString() === id)
    
    if (!recurring) return
    
    // Check if it's a loan payment
    if (recurring.type === 'transfer' && recurring.isSplit && recurring.loanDetails) {
      // Fetch the loan payment breakdown
      try {
        const response = await fetch(`/api/recurring-transactions/${id}/calculate-split`, {
          method: 'POST'
        })
        const result = await response.json()
        
        if (result.success) {
          setLoanExecutionRecurring(recurring)
          setLoanBreakdown(result.data.breakdown)
          setExecutionDueDate(dueDate)
          setShowLoanDialog(true)
        } else {
          toast.error(result.error || 'Failed to calculate loan payment')
        }
      } catch (error) {
        console.error('Error calculating loan payment:', error)
        toast.error('Failed to calculate loan payment')
      }
      return
    }

    // For all other transactions, show confirmation dialog
    setExecutionRecurring(recurring)
    setExecutionDueDate(dueDate)
    setShowExecutionDialog(true)
  }

  const handleLoanExecutionConfirm = async (principalAmount: number, interestAmount: number) => {
    if (!loanExecutionRecurring) return

    try {
      const response = await fetch(`/api/recurring-transactions/${loanExecutionRecurring._id.toString()}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalAmount,
          interestAmount,
          date: executionDueDate ? executionDueDate.toISOString() : undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Loan payment executed successfully')
        setShowLoanDialog(false)
        setLoanExecutionRecurring(null)
        setExecutionDueDate(null)
        emitAccountUpdate() // Notify sidebar to refresh
        fetchData()
      } else {
        toast.error(result.error || 'Failed to execute loan payment')
      }
    } catch (error) {
      console.error('Error executing loan payment:', error)
      toast.error('Failed to execute loan payment')
    }
  }

  const handleExecutionConfirm = async (data: {
    amount: number
    description: string
    notes?: string
    date: string
    accountId?: string
    toAccountId?: string
  }) => {
    if (!executionRecurring) return

    try {
      const response = await fetch(`/api/recurring-transactions/${executionRecurring._id.toString()}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Transaction executed successfully')
        setShowExecutionDialog(false)
        setExecutionRecurring(null)
        emitAccountUpdate() // Notify sidebar to refresh
        fetchData()
      } else {
        toast.error(result.error || 'Failed to execute transaction')
      }
    } catch (error) {
      console.error('Error executing transaction:', error)
      toast.error('Failed to execute transaction')
      throw error
    }
  }

  const handleDelete = async (id: string, dueDate: Date) => {
    setDeleteRecurringId(id)
    setDeleteDueDate(dueDate)
    setShowDeleteDialog(true)
  }

  const handleSkipOccurrence = async () => {
    if (!deleteRecurringId || !deleteDueDate) return

    try {
      const response = await fetch(`/api/recurring-transactions/${deleteRecurringId}/skip-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: deleteDueDate })
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Occurrence skipped successfully')
        setShowDeleteDialog(false)
        setDeleteRecurringId(null)
        setDeleteDueDate(null)
        fetchData()
      } else {
        toast.error(result.error || 'Failed to skip occurrence')
      }
    } catch (error) {
      console.error('Error skipping occurrence:', error)
      toast.error('Failed to skip occurrence')
    }
  }

  const handleDeleteEntireSeries = async () => {
    if (!deleteRecurringId) return

    try {
      const response = await fetch(`/api/recurring-transactions/${deleteRecurringId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Recurring transaction series deleted')
        setShowDeleteDialog(false)
        setDeleteRecurringId(null)
        setDeleteDueDate(null)
        fetchData()
      } else {
        toast.error(result.error || 'Failed to delete recurring transaction')
      }
    } catch (error) {
      console.error('Error deleting recurring transaction:', error)
      toast.error('Failed to delete recurring transaction')
    }
  }

  // Generate all occurrences for display
  const allOccurrences = useMemo(() => {
    const today = new Date()
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))

    const occurrences: Array<{
      recurringTransaction: RecurringTransaction & { accountName?: string; toAccountName?: string }
      dueDate: Date
      showExecute: boolean
    }> = []

    recurringTransactions.forEach((recurring) => {
      const dates = generateOccurrences(
        new Date(recurring.startDate),
        recurring.frequency,
        recurring.interval,
        recurring.intervalUnit,
        recurring.endDate ? new Date(recurring.endDate) : undefined,
        recurring.lastExecutedAt ? new Date(recurring.lastExecutedAt) : undefined,
        recurring.skippedDates
      )

      // Get executed dates for this recurring transaction
      const executedSet = executedDates.get(recurring._id.toString()) || new Set<string>()

      dates.forEach((date) => {
        // Check if this date has been executed
        const dateISO = new Date(date).toISOString()
        if (!executedSet.has(dateISO)) {
          // Only add if not executed
          occurrences.push({
            recurringTransaction: recurring,
            dueDate: date,
            showExecute: false // Will be determined below
          })
        }
      })
    })

    // Sort by due date
    occurrences.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

    // Determine which occurrences should show Execute button
    // Logic: All overdue + first future occurrence = Execute, rest = Edit only
    let foundFirstFuture = false
    occurrences.forEach((occurrence) => {
      const occurrenceDate = new Date(occurrence.dueDate)
      
      if (occurrenceDate <= todayUTC) {
        // Overdue or due today - show execute
        occurrence.showExecute = true
      } else if (!foundFirstFuture) {
        // First future occurrence - show execute
        occurrence.showExecute = true
        foundFirstFuture = true
      } else {
        // All other future occurrences - edit only
        occurrence.showExecute = false
      }
    })

    return occurrences
  }, [recurringTransactions, executedDates])

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

  return (
    <DashboardLayout user={user}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recurring Transactions</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your recurring income, expenses, and transfers
            </p>
          </div>
          <Button onClick={handleAddRecurring} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Recurring Transaction
          </Button>
        </div>

        {/* Recurring Transactions List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5" />
                Upcoming Recurring Transactions
              </CardTitle>
              <CardDescription>
                Execute recurring transactions to create actual transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allOccurrences.length === 0 ? (
                <div className="text-center py-12">
                  <Repeat className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No recurring transactions yet
                  </p>
                  <Button onClick={handleAddRecurring} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Your First Recurring Transaction
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {allOccurrences.map((occurrence, index) => (
                    <RecurringListItem
                      key={`${occurrence.recurringTransaction._id.toString()}-${occurrence.dueDate.toISOString()}`}
                      recurringTransaction={{
                        ...occurrence.recurringTransaction,
                        nextDueDate: occurrence.dueDate
                      }}
                      onExecute={handleExecute}
                      onEdit={handleEditRecurring}
                      onDelete={handleDelete}
                      showExecute={occurrence.showExecute}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Form Modal */}
        <RecurringFormModal
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          recurringTransaction={selectedRecurring}
          accounts={accounts}
          onSubmit={handleFormSubmit}
        />

        {/* Loan Execution Dialog */}
        {loanExecutionRecurring && loanBreakdown && (
          <LoanExecutionDialog
            open={showLoanDialog}
            onOpenChange={setShowLoanDialog}
            breakdown={loanBreakdown}
            currency={loanExecutionRecurring.currency}
            loanAccountName={
              loanExecutionRecurring.toAccountId 
                ? accounts.find(a => a._id.toString() === loanExecutionRecurring.toAccountId?.toString())?.name || 'Loan Account'
                : 'Loan Account'
            }
            onConfirm={handleLoanExecutionConfirm}
          />
        )}

        {/* General Recurring Execution Dialog */}
        {executionRecurring && (
          <RecurringExecutionDialog
            open={showExecutionDialog}
            onOpenChange={setShowExecutionDialog}
            recurringTransaction={executionRecurring}
            accounts={accounts}
            onConfirm={handleExecutionConfirm}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Delete Recurring Transaction</DialogTitle>
              <DialogDescription>
                This recurring transaction has multiple occurrences. What would you like to delete?
              </DialogDescription>
            </DialogHeader>
            
            {/* IMPORTANT: Always add px-6 to content between DialogHeader and DialogFooter */}
            <div className="px-6 space-y-4 py-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Choose one of the following options:
                </p>
                
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-4"
                    onClick={handleSkipOccurrence}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-semibold">Delete this occurrence only</span>
                      <span className="text-xs text-muted-foreground">
                        Skip this payment and keep future occurrences
                      </span>
                    </div>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-4 border-red-200 hover:bg-red-50"
                    onClick={handleDeleteEntireSeries}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-semibold text-red-600">Delete entire series</span>
                      <span className="text-xs text-muted-foreground">
                        Remove all future occurrences permanently
                      </span>
                    </div>
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setDeleteRecurringId(null)
                  setDeleteDueDate(null)
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
