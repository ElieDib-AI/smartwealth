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
import { Select } from '@/components/ui/select'
import { CustomSelect } from '@/components/ui/custom-select'
import { Button } from '@/components/ui/button'
import { Transaction, TransactionType, Account } from '@/lib/types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/constants/categories'
import { toast } from 'sonner'

interface TransactionFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  accounts: Account[]
  onSubmit: (data: TransactionFormData) => Promise<void>
  defaultAccountId?: string
}

export interface TransactionFormData {
  type: TransactionType
  amount: number
  currency: string
  accountId: string
  toAccountId?: string
  category: string
  subcategory?: string
  description: string
  notes?: string
  tags?: string[]
  date: string
  status?: 'completed' | 'pending' | 'cancelled'
  currencyConversion?: {
    fromCurrency: string
    toCurrency: string
    fromAmount: number
    toAmount: number
    exchangeRate: number
    conversionDate: Date
  }
}

export function TransactionFormModal({
  open,
  onOpenChange,
  transaction,
  accounts,
  onSubmit,
  defaultAccountId
}: TransactionFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'expense',
    amount: 0,
    currency: 'USD',
    accountId: defaultAccountId || '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    status: 'completed'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [convertedAmount, setConvertedAmount] = useState<number | undefined>(undefined)
  const [showCurrencyConversion, setShowCurrencyConversion] = useState(false)

  useEffect(() => {
    if (open) {
      // Fetch custom categories when modal opens
      fetchCustomCategories()
    }

    if (transaction) {
      setFormData({
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        accountId: transaction.accountId.toString(),
        toAccountId: transaction.toAccountId?.toString(),
        category: transaction.category,
        subcategory: transaction.subcategory,
        description: transaction.description,
        notes: transaction.notes,
        tags: transaction.tags,
        date: new Date(transaction.date).toISOString().split('T')[0],
        status: transaction.status
      })
    } else {
      // Reset form for new transaction with default account if provided
      const defaultAccount = defaultAccountId 
        ? accounts.find(a => a._id.toString() === defaultAccountId)
        : accounts[0]
      
      setFormData({
        type: 'expense',
        amount: 0,
        currency: defaultAccount?.currency || 'USD',
        accountId: defaultAccountId || accounts[0]?._id.toString() || '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'completed'
      })
    }
    setErrors({})
    setIsCustomCategory(false)
    setCustomCategoryInput('')
    setConvertedAmount(undefined)
    setShowCurrencyConversion(false)
  }, [transaction, accounts, open, defaultAccountId])

  const fetchCustomCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (data.success && data.data.custom) {
        setCustomCategories(data.data.custom.map((c: { name: string }) => c.name))
      }
    } catch (error) {
      console.error('Error fetching custom categories:', error)
    }
  }

  const handleTypeChange = (type: TransactionType) => {
    setFormData(prev => ({
      ...prev,
      type,
      category: '', // Reset category when type changes
      toAccountId: type === 'transfer' ? prev.toAccountId : undefined
    }))
  }

  const handleAccountChange = (accountId: string) => {
    const account = accounts.find(a => a._id.toString() === accountId)
    setFormData(prev => ({
      ...prev,
      accountId,
      currency: account?.currency || prev.currency
    }))
    checkCurrencyConversion(accountId, formData.toAccountId)
  }

  const handleToAccountChange = (toAccountId: string) => {
    setFormData(prev => ({ ...prev, toAccountId }))
    checkCurrencyConversion(formData.accountId, toAccountId)
  }

  const checkCurrencyConversion = (fromAccountId?: string, toAccountId?: string) => {
    if (!fromAccountId || !toAccountId) {
      setShowCurrencyConversion(false)
      return
    }

    const fromAccount = accounts.find(a => a._id.toString() === fromAccountId)
    const toAccount = accounts.find(a => a._id.toString() === toAccountId)

    if (fromAccount && toAccount && fromAccount.currency !== toAccount.currency) {
      setShowCurrencyConversion(true)
    } else {
      setShowCurrencyConversion(false)
      setConvertedAmount(undefined)
    }
  }

  const getCategoryOptions = (): Array<{ label: string; value: string; icon?: string }> => {
    if (formData.type === 'transfer') {
      return []
    }
    
    const categories = formData.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    const standardOptions = categories.map(cat => ({
      label: cat.name,
      value: cat.name,
      icon: cat.icon
    }))

    // Add custom categories
    const customOptions = customCategories.map(name => ({
      label: name,
      value: name
    }))

    // Add "Custom" option at the end
    return [
      ...standardOptions,
      ...customOptions,
      { label: '+ Custom', value: 'custom' }
    ]
  }

  const getSubcategoryOptions = () => {
    if (formData.type === 'transfer' || !formData.category) {
      return []
    }
    
    const categories = formData.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
    const category = categories.find(cat => cat.name === formData.category)
    
    return category?.subcategories || []
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }
    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0'
    }
    if (!formData.accountId) {
      newErrors.accountId = 'Account is required'
    }
    if (formData.type === 'transfer' && !formData.toAccountId) {
      newErrors.toAccountId = 'Destination account is required for transfers'
    }
    if (formData.type === 'transfer' && formData.accountId === formData.toAccountId) {
      newErrors.toAccountId = 'Source and destination accounts must be different'
    }
    if (formData.type === 'transfer' && showCurrencyConversion && (!convertedAmount || convertedAmount <= 0)) {
      newErrors.convertedAmount = 'Converted amount is required for currency transfers'
    }
    if (formData.type !== 'transfer') {
      if (isCustomCategory && !customCategoryInput.trim()) {
        newErrors.category = 'Custom category name is required'
      } else if (!isCustomCategory && !formData.category) {
        newErrors.category = 'Category is required'
      }
    }
    if (!formData.date) {
      newErrors.date = 'Date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // If custom category is being entered, use that value
    let finalFormData = { ...formData }
    
    // For transfers, set a default category if not provided
    if (finalFormData.type === 'transfer' && !finalFormData.category) {
      finalFormData.category = 'Transfer'
    }
    
    if (isCustomCategory && customCategoryInput.trim()) {
      finalFormData.category = customCategoryInput.trim()
      
      // Create the custom category if it doesn't exist
      if (!customCategories.includes(customCategoryInput.trim())) {
        try {
          const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              name: customCategoryInput.trim(),
              type: finalFormData.type // 'expense' or 'income'
            })
          })
          
          if (response.ok) {
            await fetchCustomCategories()
          }
        } catch (error) {
          console.error('Error creating custom category:', error)
        }
      }
    }

    // Add currency conversion data for cross-currency transfers
    if (finalFormData.type === 'transfer' && showCurrencyConversion && convertedAmount) {
      const fromAccount = accounts.find(a => a._id.toString() === finalFormData.accountId)
      const toAccount = accounts.find(a => a._id.toString() === finalFormData.toAccountId)
      
      if (fromAccount && toAccount) {
        finalFormData.currencyConversion = {
          fromCurrency: fromAccount.currency,
          toCurrency: toAccount.currency,
          fromAmount: finalFormData.amount,
          toAmount: convertedAmount,
          exchangeRate: convertedAmount / finalFormData.amount,
          conversionDate: new Date(finalFormData.date)
        }
      }
    }
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(finalFormData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting transaction:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map(t => t.trim()).filter(t => t.length > 0)
    setFormData(prev => ({ ...prev, tags }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </DialogTitle>
          <DialogDescription>
            {transaction 
              ? 'Update the transaction details below.' 
              : 'Enter the details for your new transaction.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {/* Transaction Type */}
          <div>
            <Label htmlFor="type">Transaction Type *</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  formData.type === 'expense'
                    ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  formData.type === 'income'
                    ? 'border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('transfer')}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  formData.type === 'transfer'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                Transfer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                className={errors.amount ? 'border-red-500' : ''}
              />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            </div>

            {/* Currency */}
            <div>
              <Label htmlFor="currency">Currency *</Label>
              <Select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="JPY">JPY - Japanese Yen</option>
              </Select>
            </div>
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="accountId">
                {formData.type === 'transfer' ? 'From Account *' : 'Account *'}
              </Label>
              <Select
                id="accountId"
                value={formData.accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className={errors.accountId ? 'border-red-500' : ''}
              >
                <option value="">Select account</option>
                {Array.isArray(accounts) && accounts.map((account) => (
                  <option key={account._id.toString()} value={account._id.toString()}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </Select>
              {errors.accountId && <p className="text-xs text-red-500 mt-1">{errors.accountId}</p>}
            </div>

            {formData.type === 'transfer' && (
              <div>
                <Label htmlFor="toAccountId">To Account *</Label>
                <Select
                  id="toAccountId"
                  value={formData.toAccountId || ''}
                  onChange={(e) => handleToAccountChange(e.target.value)}
                  className={errors.toAccountId ? 'border-red-500' : ''}
                >
                  <option value="">Select account</option>
                  {Array.isArray(accounts) && accounts
                    .filter(a => a._id.toString() !== formData.accountId)
                    .map((account) => (
                      <option key={account._id.toString()} value={account._id.toString()}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                </Select>
                {errors.toAccountId && <p className="text-xs text-red-500 mt-1">{errors.toAccountId}</p>}
              </div>
            )}
          </div>

          {/* Currency Conversion (for cross-currency transfers) */}
          {formData.type === 'transfer' && showCurrencyConversion && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-400">
                <span>💱</span>
                <span>Currency Conversion Required</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fromAmount" className="text-sm">
                    Amount Sent ({accounts.find(a => a._id.toString() === formData.accountId)?.currency}) *
                  </Label>
                  <Input
                    id="fromAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="font-semibold"
                  />
                </div>
                <div>
                  <Label htmlFor="toAmount" className="text-sm">
                    Amount Received ({accounts.find(a => a._id.toString() === formData.toAccountId)?.currency}) *
                  </Label>
                  <Input
                    id="toAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={convertedAmount || ''}
                    onChange={(e) => setConvertedAmount(parseFloat(e.target.value) || 0)}
                    className={`font-semibold ${errors.convertedAmount ? 'border-red-500' : ''}`}
                  />
                  {errors.convertedAmount && <p className="text-xs text-red-500 mt-1">{errors.convertedAmount}</p>}
                </div>
              </div>
              {formData.amount > 0 && convertedAmount && convertedAmount > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Exchange Rate: 1 {accounts.find(a => a._id.toString() === formData.accountId)?.currency} = {(convertedAmount / formData.amount).toFixed(4)} {accounts.find(a => a._id.toString() === formData.toAccountId)?.currency}
                </p>
              )}
            </div>
          )}

          {/* Category (not for transfers) */}
          {formData.type !== 'transfer' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    id="category"
                    value={isCustomCategory ? 'custom' : formData.category}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === 'custom') {
                        setIsCustomCategory(true)
                        setFormData(prev => ({ ...prev, category: '', subcategory: undefined }))
                      } else {
                        setIsCustomCategory(false)
                        setCustomCategoryInput('')
                        setFormData(prev => ({ ...prev, category: value, subcategory: undefined }))
                      }
                    }}
                    className={errors.category ? 'border-red-500' : ''}
                  >
                    <option value="">Select category</option>
                    {getCategoryOptions().map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon ? `${cat.icon} ` : ''}{cat.label}
                      </option>
                    ))}
                  </Select>
                  {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
                </div>

                {!isCustomCategory && getSubcategoryOptions().length > 0 && (
                  <div>
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Select
                      id="subcategory"
                      value={formData.subcategory || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                    >
                      <option value="">None</option>
                      {getSubcategoryOptions().map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {isCustomCategory && (
                <div>
                  <Label htmlFor="customCategory">Custom Category Name *</Label>
                  <Input
                    id="customCategory"
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="Enter custom category name"
                    className={errors.category ? 'border-red-500' : ''}
                  />
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Grocery shopping at Walmart"
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className={errors.date ? 'border-red-500' : ''}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'completed' | 'pending' | 'cancelled' }))}
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              type="text"
              value={formData.tags?.join(', ') || ''}
              onChange={(e) => handleTagsChange(e.target.value)}
              placeholder="e.g., groceries, weekly, essential"
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
              {loading ? 'Saving...' : transaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
