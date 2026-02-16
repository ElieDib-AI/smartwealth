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
import { Account, RecurringTransaction, RecurringFrequency, RecurringIntervalUnit, CustomCategory, SplitPart } from '@/lib/types'
import { getFrequencyLabel } from '@/lib/utils/recurring'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

interface RecurringFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurringTransaction?: RecurringTransaction | null
  accounts: Account[]
  onSubmit: (data: RecurringFormData) => Promise<void>
}

export interface RecurringFormData {
  type: 'expense' | 'income' | 'transfer' | 'loan_payment'
  amount: number
  currency: string
  accountId: string
  toAccountId?: string
  category: string
  subcategory?: string
  description: string
  notes?: string
  isSplit?: boolean
  splits?: Array<{
    type: 'expense' | 'transfer'
    amount: number
    category: string
    toAccountId?: string
    description?: string
  }>
  loanDetails?: {
    originalAmount: number
    interestRate: number
    termMonths: number
    startDate: string
  }
  frequency: RecurringFrequency
  interval?: number
  intervalUnit?: RecurringIntervalUnit
  startDate: string
  endDate?: string
}

const transactionTypes = [
  { value: 'loan_payment', label: 'Loan Payment' },
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
  'Debt Payments', 'Savings & Investments', 'Gifts & Donations', 'Travel', 'Other', 'Custom'
]

const incomeCategories = [
  'Salary', 'Freelance', 'Business Income', 'Investment Income', 'Rental Income',
  'Interest', 'Dividends', 'Bonus', 'Gift', 'Refund', 'Other', 'Custom'
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
  const [customCategory, setCustomCategory] = useState('')
  const [showCustomCategory, setShowCustomCategory] = useState(false)
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [isSplitEnabled, setIsSplitEnabled] = useState(false)
  const [splits, setSplits] = useState<Array<{
    type: 'expense' | 'transfer'
    amount: number
    category: string
    toAccountId?: string
    description?: string
  }>>([
    { type: 'transfer', amount: 0, category: 'Principal', toAccountId: '' },
    { type: 'expense', amount: 0, category: 'Interest' }
  ])

  // Fetch custom categories
  useEffect(() => {
    const fetchCustomCategories = async () => {
      setLoadingCategories(true)
      try {
        const response = await fetch('/api/categories')
        const data = await response.json()
        if (data.success) {
          setCustomCategories(data.data.custom || [])
        }
      } catch (error) {
        console.error('Error fetching custom categories:', error)
      } finally {
        setLoadingCategories(false)
      }
    }

    if (open) {
      fetchCustomCategories()
    }
  }, [open])

  useEffect(() => {
    if (recurringTransaction) {
      const predefinedCategories = recurringTransaction.type === 'expense' ? expenseCategories : 
                                    recurringTransaction.type === 'income' ? incomeCategories : 
                                    ['Transfer']
      
      const userCustomCategories = customCategories
        .filter(c => c.type === (recurringTransaction.type === 'transfer' ? 'expense' : recurringTransaction.type))
        .map(c => c.name)
      
      const allAvailableCategories = [...predefinedCategories.filter(c => c !== 'Custom'), ...userCustomCategories]
      
      // Check if category is in the available list (predefined or saved custom)
      const isSavedCategory = allAvailableCategories.includes(recurringTransaction.category)
      
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
      
      if (!isSavedCategory) {
        // It's a new custom category being entered
        setShowCustomCategory(true)
        setCustomCategory(recurringTransaction.category)
      } else {
        setShowCustomCategory(false)
        setCustomCategory('')
      }
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
      setShowCustomCategory(false)
      setCustomCategory('')
    }
  }, [recurringTransaction, accounts, open, customCategories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // If custom category is entered, save it first
      if (showCustomCategory && customCategory.trim()) {
        const categoryType = formData.type === 'transfer' ? 'expense' : formData.type
        
        // Check if this custom category already exists
        const existingCustom = customCategories.find(
          c => c.name.toLowerCase() === customCategory.trim().toLowerCase() && c.type === categoryType
        )
        
        if (!existingCustom) {
          try {
            const response = await fetch('/api/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: customCategory.trim(),
                type: categoryType
              })
            })
            
            const result = await response.json()
            if (result.success) {
              toast.success('Custom category saved')
              // Add to local state
              setCustomCategories([...customCategories, result.data])
            }
          } catch (error) {
            console.error('Error saving custom category:', error)
            // Continue with submission even if category save fails
          }
        }
      }
      
      // Add split data if enabled
      const submitData = {
        ...formData,
        isSplit: isSplitEnabled,
        splits: isSplitEnabled ? splits : undefined
      }
      
      await onSubmit(submitData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setLoading(false)
    }
  }

  // Build categories list with predefined + custom categories
  const predefinedCategories = formData.type === 'expense' ? expenseCategories : 
                                formData.type === 'income' ? incomeCategories : 
                                ['Transfer']
  
  const userCustomCategories = customCategories
    .filter(c => c.type === (formData.type === 'transfer' ? 'expense' : formData.type))
    .map(c => c.name)
  
  const categories = [...predefinedCategories.filter(c => c !== 'Custom'), ...userCustomCategories, 'Custom']

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

        <form onSubmit={handleSubmit} className="space-y-6 px-6">
          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <CustomSelect
              value={formData.type}
              onChange={(value: string) => {
                const newType = value as 'expense' | 'income' | 'transfer' | 'loan_payment'
                setFormData({ ...formData, type: newType })
                // Auto-enable split for loan payments
                if (newType === 'loan_payment') {
                  setIsSplitEnabled(true)
                } else if (isSplitEnabled && formData.type === 'loan_payment') {
                  // If switching away from loan payment, disable split
                  setIsSplitEnabled(false)
                }
              }}
              groups={[{ label: 'Transaction Type', options: transactionTypes }]}
              placeholder="Select type"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">
                {formData.type === 'loan_payment' ? 'Monthly Payment Amount' : 'Total Amount'}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
                disabled={isSplitEnabled && formData.type !== 'loan_payment'}
              />
              {isSplitEnabled && formData.type !== 'loan_payment' && (
                <p className="text-xs text-gray-500">
                  Total: {splits.reduce((sum, split) => sum + split.amount, 0).toFixed(2)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <CustomSelect
                value={formData.currency}
                onChange={(value: string) => setFormData({ ...formData, currency: value })}
                groups={[{ label: 'Currency', options: currencies }]}
                placeholder="Select currency"
              />
            </div>
          </div>

          {/* Split Parts (not shown for loan payments - auto-calculated) */}
          {isSplitEnabled && formData.type !== 'loan_payment' && (
            <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Split Parts</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSplits([...splits, { type: 'expense', amount: 0, category: '' }])}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Part
                </Button>
              </div>

              {splits.map((split, index) => (
                <div key={index} className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-950">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Part {index + 1}</Label>
                    {splits.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSplits(splits.filter((_, i) => i !== index))}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <CustomSelect
                        value={split.type}
                        onChange={(value: string) => {
                          const newSplits = [...splits]
                          newSplits[index].type = value as 'expense' | 'transfer'
                          setSplits(newSplits)
                        }}
                        groups={[{ 
                          label: 'Type', 
                          options: [
                            { value: 'expense', label: 'Expense' },
                            { value: 'transfer', label: 'Transfer' }
                          ] 
                        }]}
                        placeholder="Type"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={split.amount}
                        onChange={(e) => {
                          const newSplits = [...splits]
                          newSplits[index].amount = parseFloat(e.target.value) || 0
                          setSplits(newSplits)
                          // Update total amount
                          setFormData({ 
                            ...formData, 
                            amount: newSplits.reduce((sum, s) => sum + s.amount, 0) 
                          })
                        }}
                        className="h-8"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Input
                      value={split.category}
                      onChange={(e) => {
                        const newSplits = [...splits]
                        newSplits[index].category = e.target.value
                        setSplits(newSplits)
                      }}
                      placeholder="e.g., Principal, Interest"
                      className="h-8"
                      required
                    />
                  </div>

                  {split.type === 'transfer' && (
                    <div className="space-y-1">
                      <Label className="text-xs">To Account</Label>
                      <CustomSelect
                        value={split.toAccountId || ''}
                        onChange={(value: string) => {
                          const newSplits = [...splits]
                          newSplits[index].toAccountId = value
                          setSplits(newSplits)
                        }}
                        groups={[{ 
                          label: 'Account', 
                          options: accounts.filter(a => a._id.toString() !== formData.accountId).map(a => ({ 
                            value: a._id.toString(), 
                            label: a.name 
                          }))
                        }]}
                        placeholder="Select account"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Description (Optional)</Label>
                    <Input
                      value={split.description || ''}
                      onChange={(e) => {
                        const newSplits = [...splits]
                        newSplits[index].description = e.target.value
                        setSplits(newSplits)
                      }}
                      placeholder="Optional description"
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Account */}
          <div className="space-y-2">
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

          {/* To Account (for transfers and loan payments) */}
          {((formData.type === 'transfer' && !isSplitEnabled) || formData.type === 'loan_payment') && (
            <div className="space-y-2">
              <Label htmlFor="toAccountId">
                {formData.type === 'loan_payment' ? 'Loan Account' : 'To Account'}
              </Label>
              <CustomSelect
                value={formData.toAccountId || ''}
                onChange={(value: string) => setFormData({ ...formData, toAccountId: value })}
                groups={[{ 
                  label: formData.type === 'loan_payment' ? 'Loan Account' : 'Destination Account', 
                  options: accounts.filter(a => a._id.toString() !== formData.accountId).map(a => ({ 
                    value: a._id.toString(), 
                    label: a.name 
                  }))
                }]}
                placeholder={formData.type === 'loan_payment' ? 'Select loan account' : 'Select destination account'}
              />
              {formData.type === 'loan_payment' && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  The current balance from this account will be used for calculations
                </p>
              )}
            </div>
          )}

          {/* Loan Details (only for loan payments) */}
          {formData.type === 'loan_payment' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="originalAmount">Original Loan Amount</Label>
                <Input
                  id="originalAmount"
                  type="number"
                  step="0.01"
                  value={formData.loanDetails?.originalAmount || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    loanDetails: { 
                      ...formData.loanDetails,
                      originalAmount: parseFloat(e.target.value) || 0,
                      interestRate: formData.loanDetails?.interestRate || 0,
                      termMonths: formData.loanDetails?.termMonths || 0,
                      startDate: formData.loanDetails?.startDate || new Date().toISOString().split('T')[0]
                    } 
                  })}
                  placeholder="e.g., 250000"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="interestRate">Annual Interest Rate (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    value={formData.loanDetails?.interestRate || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      loanDetails: { 
                        ...formData.loanDetails,
                        originalAmount: formData.loanDetails?.originalAmount || 0,
                        interestRate: parseFloat(e.target.value) || 0,
                        termMonths: formData.loanDetails?.termMonths || 0,
                        startDate: formData.loanDetails?.startDate || new Date().toISOString().split('T')[0]
                      } 
                    })}
                    placeholder="e.g., 5.5"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="termMonths">Loan Term (months)</Label>
                  <Input
                    id="termMonths"
                    type="number"
                    value={formData.loanDetails?.termMonths || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      loanDetails: { 
                        ...formData.loanDetails,
                        originalAmount: formData.loanDetails?.originalAmount || 0,
                        interestRate: formData.loanDetails?.interestRate || 0,
                        termMonths: parseInt(e.target.value) || 0,
                        startDate: formData.loanDetails?.startDate || new Date().toISOString().split('T')[0]
                      } 
                    })}
                    placeholder="e.g., 360"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loanStartDate">Loan Start Date</Label>
                <Input
                  id="loanStartDate"
                  type="date"
                  value={formData.loanDetails?.startDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    loanDetails: { 
                      ...formData.loanDetails,
                      originalAmount: formData.loanDetails?.originalAmount || 0,
                      interestRate: formData.loanDetails?.interestRate || 0,
                      termMonths: formData.loanDetails?.termMonths || 0,
                      startDate: e.target.value
                    } 
                  })}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  When the loan was disbursed (first payment is typically one month after)
                </p>
              </div>
            </>
          )}

          {/* Category */}
          {!isSplitEnabled && formData.type !== 'loan_payment' && (
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <CustomSelect
                value={showCustomCategory ? 'Custom' : formData.category}
                onChange={(value: string) => {
                  if (value === 'Custom') {
                    setShowCustomCategory(true)
                    setFormData({ ...formData, category: customCategory })
                  } else {
                    setShowCustomCategory(false)
                    setFormData({ ...formData, category: value })
                  }
                }}
                groups={[{ label: 'Categories', options: categories.map(c => ({ value: c, label: c })) }]}
                placeholder="Select category"
              />
            </div>
          )}

          {/* Custom Category Input */}
          {showCustomCategory && !isSplitEnabled && formData.type !== 'loan_payment' && (
            <div className="space-y-2">
              <Label htmlFor="customCategory">Custom Category Name</Label>
              <Input
                id="customCategory"
                value={customCategory}
                onChange={(e) => {
                  setCustomCategory(e.target.value)
                  setFormData({ ...formData, category: e.target.value })
                }}
                placeholder="Enter custom category name"
                required
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
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
          <div className="space-y-2">
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
          <div className="space-y-2">
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
              <div className="space-y-2">
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
              <div className="space-y-2">
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
          <div className="space-y-2">
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
          <div className="space-y-2">
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
