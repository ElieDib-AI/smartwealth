'use client'

import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RecurringTransaction, Account } from '@/lib/types'
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Calendar } from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'

interface RecurringExecutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurringTransaction: RecurringTransaction & { accountName?: string; toAccountName?: string }
  accounts: Account[]
  onConfirm: (data: {
    amount: number
    description: string
    notes?: string
    date: string
    accountId?: string
    toAccountId?: string
  }) => Promise<void>
}

export function RecurringExecutionDialog({
  open,
  onOpenChange,
  recurringTransaction,
  accounts,
  onConfirm
}: RecurringExecutionDialogProps) {
  const [amount, setAmount] = useState(recurringTransaction.amount)
  const [description, setDescription] = useState(recurringTransaction.description)
  const [notes, setNotes] = useState(recurringTransaction.notes || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [accountId, setAccountId] = useState(recurringTransaction.accountId.toString())
  const [toAccountId, setToAccountId] = useState(recurringTransaction.toAccountId?.toString() || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(recurringTransaction.amount)
      setDescription(recurringTransaction.description)
      setNotes(recurringTransaction.notes || '')
      setDate(new Date(recurringTransaction.nextDueDate).toISOString().split('T')[0])
      setAccountId(recurringTransaction.accountId.toString())
      setToAccountId(recurringTransaction.toAccountId?.toString() || '')
    }
  }, [open, recurringTransaction])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: recurringTransaction.currency
    }).format(amount)
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm({
        amount,
        description,
        notes: notes.trim() || undefined,
        date,
        accountId: accountId !== recurringTransaction.accountId.toString() ? accountId : undefined,
        toAccountId: recurringTransaction.type === 'transfer' && toAccountId !== recurringTransaction.toAccountId?.toString() ? toAccountId : undefined
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error confirming execution:', error)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = () => {
    if (recurringTransaction.type === 'income') {
      return <ArrowDownRight className="h-5 w-5 text-green-600" />
    } else if (recurringTransaction.type === 'expense') {
      return <ArrowUpRight className="h-5 w-5 text-red-600" />
    } else {
      return <ArrowLeftRight className="h-5 w-5 text-blue-600" />
    }
  }

  const getTypeLabel = () => {
    if (recurringTransaction.type === 'income') return 'Income'
    if (recurringTransaction.type === 'expense') return 'Expense'
    return 'Transfer'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            Execute Recurring Transaction
          </DialogTitle>
          <DialogDescription>
            Review and confirm the transaction details before execution
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-5 py-2">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</Label>
            <div className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800">
              <span className="font-medium">{getTypeLabel()}</span>
              {recurringTransaction.category && (
                <span className="text-gray-600 dark:text-gray-400">• {recurringTransaction.category}</span>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Amount *
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="font-semibold"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
              Original: {formatCurrency(recurringTransaction.amount)}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Description *
            </Label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Date *
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1.5">
              <Calendar className="h-3 w-3" />
              Due: {new Date(recurringTransaction.nextDueDate).toLocaleDateString()}
            </p>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label htmlFor="account" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Account *
            </Label>
            <CustomSelect
              value={accountId}
              onChange={setAccountId}
              groups={[
                {
                  label: 'Accounts',
                  options: accounts.map(acc => ({
                    label: acc.name,
                    value: acc._id.toString()
                  }))
                }
              ]}
              placeholder="Select account"
            />
          </div>

          {/* To Account (for transfers) */}
          {recurringTransaction.type === 'transfer' && (
            <div className="space-y-2">
              <Label htmlFor="toAccount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                To Account *
              </Label>
              <CustomSelect
                value={toAccountId}
                onChange={setToAccountId}
                groups={[
                  {
                    label: 'Accounts',
                    options: accounts
                      .filter(acc => acc._id.toString() !== accountId)
                      .map(acc => ({
                        label: acc.name,
                        value: acc._id.toString()
                      }))
                  }
                ]}
                placeholder="Select destination account"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              loading || 
              !description.trim() || 
              amount <= 0 || 
              !accountId ||
              (recurringTransaction.type === 'transfer' && !toAccountId)
            }
            className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600"
          >
            {loading ? 'Executing...' : 'Confirm & Execute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
