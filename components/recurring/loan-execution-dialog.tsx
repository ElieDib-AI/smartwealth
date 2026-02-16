'use client'

import { useState } from 'react'
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
import { ArrowLeftRight, TrendingUp } from 'lucide-react'
import { PaymentBreakdown } from '@/lib/utils/loan-calculator'

interface LoanExecutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  breakdown: PaymentBreakdown
  currency: string
  loanAccountName: string
  onConfirm: (principalAmount: number, interestAmount: number) => Promise<void>
}

export function LoanExecutionDialog({
  open,
  onOpenChange,
  breakdown,
  currency,
  loanAccountName,
  onConfirm
}: LoanExecutionDialogProps) {
  const [principalAmount, setPrincipalAmount] = useState(breakdown.principal)
  const [interestAmount, setInterestAmount] = useState(breakdown.interest)
  const [loading, setLoading] = useState(false)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount)
  }

  const totalAmount = principalAmount + interestAmount
  const newBalance = breakdown.remainingBalance - (principalAmount - breakdown.principal)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(principalAmount, interestAmount)
      onOpenChange(false)
    } catch (error) {
      console.error('Error executing loan payment:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Loan Payment</DialogTitle>
          <DialogDescription>
            Review and adjust the payment breakdown before executing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Breakdown */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Principal</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Transfer to {loanAccountName}</p>
                </div>
              </div>
              <div className="text-right">
                <Input
                  type="number"
                  step="0.01"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Interest</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expense</p>
                </div>
              </div>
              <div className="text-right">
                <Input
                  type="number"
                  step="0.01"
                  value={interestAmount}
                  onChange={(e) => setInterestAmount(parseFloat(e.target.value) || 0)}
                  className="w-32 text-right font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Payment</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Current Balance</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {formatCurrency(breakdown.remainingBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">New Balance</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(newBalance)}
              </span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Payment #{breakdown.paymentNumber} • 
              {' '}{((breakdown.remainingBalance - newBalance) / breakdown.remainingBalance * 100).toFixed(1)}% of balance paid
            </p>
          </div>
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
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading || totalAmount <= 0}
            className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600"
          >
            {loading ? 'Executing...' : 'Confirm & Execute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
