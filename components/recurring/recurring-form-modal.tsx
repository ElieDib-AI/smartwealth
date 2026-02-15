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
import { CustomSelect } from '@/components/ui/custom-select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Account, RecurringTransaction, RecurringFrequency, RecurringIntervalUnit } from '@/lib/types'
import { getFrequencyLabel } from '@/lib/utils/recurring'

interface RecurringFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurringTransaction?: RecurringTransaction | null
  accounts: Account[]
  onSubmit: (data: RecurringFormData) => Promise<void>
}

export interface RecurringFormData {
  type: 'expense' | 'income' | 'transfer'
  amount: number
  currency: string
  accountId: string
  toAccountId?: string
  category: string
  subcategory?: string
  description: string
  notes?: string
  frequency: RecurringFrequency
  interval?: number
  intervalUnit?: RecurringIntervalUnit
  startDate: string
  endDate?: string
}

const transactionTypes = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' }
]

const frequencies = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannually', label: 'Semi-annually' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' }
]

const intervalUnits = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' }
]

const currencies = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'AED', label: 'AED (د.إ)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'LBP', label: 'LBP (ل.ل)' }
]

const expenseCategories = [
  'Housing', 'Transportation', 'Food & Dining', 'Utilities', 'Healthcare',
  'Entertainment', 'Shopping', 'Personal Care', 'Education', 'Insurance',
  'Debt Payments', 'Savings & Investments', 'Gifts & Donations', 'Travel', 'Other'
]

const incomeCategories = [
  'Salary', 'Freelance', 'Business Income', 'Investment Income', 'Rental Income',
  'Interest', 'Dividends', 'Bonus', 'Gift', 'Refund', 'Other'
]

export function RecurringFormModal({ 
  open, 
  onOpenChange, 
  recurringTransaction, 
  accounts,
  onSubmit 
}: RecurringFormModalProps) {
  const [formData, setFormData] = useState<RecurringFormData>({
    type: 'expense',
    amount: 0,
    currency: 'USD',
    accountId: '',
    category: '',
    description: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (recurringTransaction) {
      setFormData({
        type: recurringTransaction.type,
        amount: recurringTransaction.amount,
        currency: recurringTransaction.currency,
        accountId: recurringTransaction.accountId.toString(),
        toAccountId: recurringTransaction.toAccountId?.toString(),
        category: recurringTransaction.category,
        subcategory: recurringTransaction.subcategory,
        description: recurringTransaction.description,
        notes: recurringTransaction.notes,
        frequency: recurringTransaction.frequency,
        interval: recurringTransaction.interval,
        intervalUnit: recurringTransaction.intervalUnit,
        startDate: new Date(recurringTransaction.startDate).toISOString().split('T')[0],
        endDate: recurringTransaction.endDate ? new Date(recurringTransaction.endDate).toISOString().split('T')[0] : undefined
      })
    } else {
      setFormData({
        type: 'expense',
        amount: 0,
        currency: 'USD',
        accountId: accounts.length > 0 ? accounts[0]._id.toString() : '',
        category: '',
        description: '',
        frequency: 'monthly',
        startDate: new Date().toISOString().split('T')[0]
      })
    }
  }, [recurringTransaction, accounts, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = formData.type === 'expense' ? expenseCategories : 
                     formData.type === 'income' ? incomeCategories : 
                     ['Transfer']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {recurringTransaction ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}
          </DialogTitle>
          <DialogDescription>
            Create a recurring transaction that will be executed on a regular schedule.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div>
            <Label htmlFor="type">Type</Label>
            <CustomSelect
              value={formData.type}
              onChange={(value: string) => setFormData({ ...formData, type: value as 'expense' | 'income' | 'transfer' })}
              groups={[{ label: 'Transaction Type', options: transactionTypes }]}
              placeholder="Select type"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <CustomSelect
                value={formData.currency}
                onChange={(value: string) => setFormData({ ...formData, currency: value })}
                groups={[{ label: 'Currency', options: currencies }]}
                placeholder="Select currency"
              />
            </div>
          </div>

          {/* Account */}
          <div>
            <Label htmlFor="accountId">
              {formData.type === 'income' ? 'To Account' : 'From Account'}
            </Label>
            <CustomSelect
              value={formData.accountId}
              onChange={(value: string) => setFormData({ ...formData, accountId: value })}
              groups={[{ label: 'Accounts', options: accounts.map(a => ({ value: a._id.toString(), label: a.name })) }]}
              placeholder="Select account"
            />
          </div>

          {/* To Account (for transfers) */}
          {formData.type === 'transfer' && (
            <div>
              <Label htmlFor="toAccountId">To Account</Label>
              <CustomSelect
                value={formData.toAccountId || ''}
                onChange={(value: string) => setFormData({ ...formData, toAccountId: value })}
                groups={[{ 
                  label: 'Destination Account', 
                  options: accounts.filter(a => a._id.toString() !== formData.accountId).map(a => ({ 
                    value: a._id.toString(), 
                    label: a.name 
                  }))
                }]}
                placeholder="Select destination account"
              />
            </div>
          )}

          {/* Category */}
          <div>
            <Label htmlFor="category">Category</Label>
            <CustomSelect
              value={formData.category}
              onChange={(value: string) => setFormData({ ...formData, category: value })}
              groups={[{ label: 'Categories', options: categories.map(c => ({ value: c, label: c })) }]}
              placeholder="Select category"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Monthly rent payment"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          {/* Frequency */}
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <CustomSelect
              value={formData.frequency}
              onChange={(value: string) => setFormData({ ...formData, frequency: value as RecurringFrequency })}
              groups={[{ label: 'Frequency', options: frequencies }]}
              placeholder="Select frequency"
            />
          </div>

          {/* Custom Frequency Options */}
          {formData.frequency === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="interval">Every</Label>
                <Input
                  id="interval"
                  type="number"
                  min="1"
                  value={formData.interval || 1}
                  onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="intervalUnit">Unit</Label>
                <CustomSelect
                  value={formData.intervalUnit || 'days'}
                  onChange={(value: string) => setFormData({ ...formData, intervalUnit: value as RecurringIntervalUnit })}
                  groups={[{ label: 'Unit', options: intervalUnits }]}
                  placeholder="Select unit"
                />
              </div>
            </div>
          )}

          {/* Start Date */}
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              required
            />
          </div>

          {/* End Date (Optional) */}
          <div>
            <Label htmlFor="endDate">End Date (Optional)</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate || ''}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value || undefined })}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : recurringTransaction ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
