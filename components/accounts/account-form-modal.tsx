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
import { Button } from '@/components/ui/button'
import { Account, AccountType } from '@/lib/types'
import { 
  Wallet, 
  PiggyBank, 
  CreditCard, 
  TrendingUp, 
  Banknote 
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
  balance: number
  currency: string
  institution?: string
  color: string
  icon: string
}

const accountTypes: { value: AccountType; label: string; icon: typeof Wallet }[] = [
  { value: 'checking', label: 'Checking Account', icon: Wallet },
  { value: 'savings', label: 'Savings Account', icon: PiggyBank },
  { value: 'credit', label: 'Credit Card', icon: CreditCard },
  { value: 'investment', label: 'Investment Account', icon: TrendingUp },
  { value: 'cash', label: 'Cash', icon: Banknote }
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
  checking: 'Wallet',
  savings: 'PiggyBank',
  credit: 'CreditCard',
  investment: 'TrendingUp',
  cash: 'Banknote'
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
        balance: 0,
        currency: 'USD',
        institution: '',
        color: 'from-cyan-600 to-blue-500',
        icon: 'Wallet'
      })
    }
    setErrors({})
  }, [account, open])

  const handleTypeChange = (type: AccountType) => {
    setFormData(prev => ({
      ...prev,
      type,
      icon: accountIconsByType[type],
      color: type === 'checking' ? 'from-cyan-600 to-blue-500' :
             type === 'savings' ? 'from-emerald-600 to-green-500' :
             type === 'credit' ? 'from-amber-600 to-orange-500' :
             type === 'investment' ? 'from-indigo-600 to-purple-500' :
             'from-gray-600 to-gray-500'
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

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
            <Select
              id="type"
              value={formData.type}
              onChange={(e) => handleTypeChange(e.target.value as AccountType)}
            >
              {accountTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
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
