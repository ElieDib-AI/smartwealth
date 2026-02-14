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
import { Account, AccountType, AccountCategory } from '@/lib/types'
import { 
  Wallet, 
  PiggyBank, 
  CreditCard, 
  TrendingUp, 
  Banknote,
  Home,
  Car,
  Gem,
  Package,
  LineChart,
  Bitcoin,
  Building2
} from 'lucide-react'

interface AccountFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
  onSubmit: (data: AccountFormData) => Promise<void>
}

export interface AccountFormData {
  name: string
  type: AccountType
  category: AccountCategory
  balance: number
  currency: string
  institution?: string
  color: string
  icon: string
}

const accountCategories = [
  {
    category: 'bank' as AccountCategory,
    label: 'Bank Accounts',
    icon: Building2,
    types: [
      { value: 'checking' as AccountType, label: 'Checking Account', icon: Wallet },
      { value: 'savings' as AccountType, label: 'Savings Account', icon: PiggyBank },
      { value: 'cash' as AccountType, label: 'Cash/Wallet', icon: Banknote }
    ]
  },
  {
    category: 'credit_loans' as AccountCategory,
    label: 'Credit & Loans',
    icon: CreditCard,
    types: [
      { value: 'credit_card' as AccountType, label: 'Credit Card', icon: CreditCard },
      { value: 'personal_loan' as AccountType, label: 'Personal Loan', icon: Banknote },
      { value: 'mortgage' as AccountType, label: 'Mortgage', icon: Home },
      { value: 'car_loan' as AccountType, label: 'Car Loan', icon: Car },
      { value: 'student_loan' as AccountType, label: 'Student Loan', icon: Package }
    ]
  },
  {
    category: 'investments' as AccountCategory,
    label: 'Investments',
    icon: TrendingUp,
    types: [
      { value: 'stocks' as AccountType, label: 'Stocks & Shares', icon: LineChart },
      { value: 'retirement' as AccountType, label: 'Retirement Account', icon: PiggyBank },
      { value: 'crypto' as AccountType, label: 'Crypto', icon: Bitcoin },
      { value: 'mutual_funds' as AccountType, label: 'Mutual Funds', icon: TrendingUp }
    ]
  },
  {
    category: 'assets' as AccountCategory,
    label: 'Assets',
    icon: Home,
    types: [
      { value: 'real_estate' as AccountType, label: 'Real Estate/Property', icon: Home },
      { value: 'vehicle' as AccountType, label: 'Vehicle', icon: Car },
      { value: 'valuables' as AccountType, label: 'Valuables (Jewelry, Art, etc.)', icon: Gem },
      { value: 'other_assets' as AccountType, label: 'Other Assets', icon: Package }
    ]
  }
]

const accountColors = [
  { value: 'from-cyan-600 to-blue-500', label: 'Blue' },
  { value: 'from-emerald-600 to-green-500', label: 'Green' },
  { value: 'from-amber-600 to-orange-500', label: 'Orange' },
  { value: 'from-indigo-600 to-purple-500', label: 'Purple' },
  { value: 'from-red-600 to-pink-500', label: 'Red' },
  { value: 'from-gray-600 to-gray-500', label: 'Gray' }
]

const accountIconsByType: Record<AccountType, string> = {
  // Bank Accounts
  checking: 'Wallet',
  savings: 'PiggyBank',
  cash: 'Banknote',
  // Credit & Loans
  credit_card: 'CreditCard',
  personal_loan: 'Banknote',
  mortgage: 'Home',
  car_loan: 'Car',
  student_loan: 'Package',
  // Investments
  stocks: 'LineChart',
  retirement: 'PiggyBank',
  crypto: 'Bitcoin',
  mutual_funds: 'TrendingUp',
  // Assets
  real_estate: 'Home',
  vehicle: 'Car',
  valuables: 'Gem',
  other_assets: 'Package'
}

const accountColorsByCategory: Record<AccountCategory, string> = {
  bank: 'from-cyan-600 to-blue-500',
  credit_loans: 'from-amber-600 to-orange-500',
  investments: 'from-indigo-600 to-purple-500',
  assets: 'from-emerald-600 to-green-500'
}

export function AccountFormModal({ 
  open, 
  onOpenChange, 
  account, 
  onSubmit 
}: AccountFormModalProps) {
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    type: 'checking',
    category: 'bank',
    balance: 0,
    currency: 'USD',
    institution: '',
    color: 'from-cyan-600 to-blue-500',
    icon: 'Wallet'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        category: account.category,
        balance: account.balance,
        currency: account.currency,
        institution: account.institution || '',
        color: account.color,
        icon: account.icon
      })
    } else {
      setFormData({
        name: '',
        type: 'checking',
        category: 'bank',
        balance: 0,
        currency: 'USD',
        institution: '',
        color: 'from-cyan-600 to-blue-500',
        icon: 'Wallet'
      })
    }
    setErrors({})
  }, [account, open])

  const handleTypeChange = (type: AccountType, category: AccountCategory) => {
    setFormData(prev => ({
      ...prev,
      type,
      category,
      icon: accountIconsByType[type],
      color: accountColorsByCategory[category]
    }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Account name is required'
    } else if (formData.name.length > 50) {
      newErrors.name = 'Account name must be 50 characters or less'
    }

    if (!formData.type) {
      newErrors.type = 'Account type is required'
    }

    if (formData.balance === undefined || formData.balance === null) {
      newErrors.balance = 'Balance is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {account ? 'Edit Account' : 'Add New Account'}
          </DialogTitle>
          <DialogDescription>
            {account 
              ? 'Update your account information below.' 
              : 'Create a new account to track your finances.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Account Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Chase Checking"
              maxLength={50}
            />
            {errors.name && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              Account Type <span className="text-red-500">*</span>
            </Label>
            <CustomSelect
              id="type"
              value={formData.type}
              onChange={(selectedType) => {
                const category = accountCategories.find(cat => 
                  cat.types.some(t => t.value === selectedType)
                )?.category || 'bank'
                handleTypeChange(selectedType as AccountType, category)
              }}
              groups={accountCategories.map(cat => ({
                label: cat.label,
                options: cat.types.map(t => ({
                  value: t.value,
                  label: t.label
                }))
              }))}
              placeholder="Select account type"
            />
            {errors.type && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.type}</p>
            )}
          </div>

          {/* Balance */}
          <div className="space-y-2">
            <Label htmlFor="balance">
              Current Balance <span className="text-red-500">*</span>
            </Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={formData.balance}
              onChange={(e) => setFormData(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
            />
            {errors.balance && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.balance}</p>
            )}
          </div>

          {/* Currency */}
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              value={formData.currency}
              onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="AED">AED - UAE Dirham</option>
            </Select>
          </div>

          {/* Institution (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="institution">Institution (Optional)</Label>
            <Input
              id="institution"
              value={formData.institution}
              onChange={(e) => setFormData(prev => ({ ...prev, institution: e.target.value }))}
              placeholder="e.g., Chase Bank"
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Account Color</Label>
            <div className="grid grid-cols-6 gap-2">
              {accountColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                  className={`h-10 rounded-lg bg-gradient-to-br ${color.value} transition-transform hover:scale-110 ${
                    formData.color === color.value ? 'ring-2 ring-primary-600 ring-offset-2' : ''
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : account ? 'Update Account' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
