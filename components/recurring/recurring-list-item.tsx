'use client'

import { useState } from 'react'
import { RecurringTransaction } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeftRight,
  Play,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react'
import { getFrequencyLabel, formatDueDate, isOverdue } from '@/lib/utils/recurring'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface RecurringListItemProps {
  recurringTransaction: RecurringTransaction & { accountName?: string; toAccountName?: string }
  onExecute: (id: string) => void
  onEdit: (recurringTransaction: RecurringTransaction) => void
  onDelete: (id: string) => void
  showExecute?: boolean // Whether to show execute button (vs edit only)
}

export function RecurringListItem({ 
  recurringTransaction, 
  onExecute, 
  onEdit, 
  onDelete,
  showExecute = true
}: RecurringListItemProps) {
  const [showActions, setShowActions] = useState(false)
  const [loading, setLoading] = useState(false)

  const isIncome = recurringTransaction.type === 'income'
  const isExpense = recurringTransaction.type === 'expense'
  const isTransfer = recurringTransaction.type === 'transfer'
  const overdue = isOverdue(recurringTransaction.nextDueDate)

  const handleExecute = async () => {
    setLoading(true)
    try {
      await onExecute(recurringTransaction._id.toString())
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border transition-colors",
        overdue 
          ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10" 
          : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Icon and Details */}
      <div className="flex items-center gap-4 flex-1">
        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          isIncome ? 'bg-green-100 dark:bg-green-900/20' :
          isExpense ? 'bg-red-100 dark:bg-red-900/20' :
          'bg-blue-100 dark:bg-blue-900/20'
        )}>
          {isIncome && <ArrowDownRight className="h-5 w-5 text-green-600" />}
          {isExpense && <ArrowUpRight className="h-5 w-5 text-red-600" />}
          {isTransfer && <ArrowLeftRight className="h-5 w-5 text-blue-600" />}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {recurringTransaction.description}
            </p>
            {overdue && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                Overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span>{recurringTransaction.category}</span>
            <span>•</span>
            <span>{recurringTransaction.accountName}</span>
            {isTransfer && recurringTransaction.toAccountName && (
              <>
                <span>→</span>
                <span>{recurringTransaction.toAccountName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mt-1">
            <span>{getFrequencyLabel(recurringTransaction.frequency, recurringTransaction.interval, recurringTransaction.intervalUnit)}</span>
            <span>•</span>
            <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
              {formatDueDate(recurringTransaction.nextDueDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Due Date Badge - 20% */}
      <div className="flex items-center justify-center w-1/5 px-2">
        <div className={cn(
          "px-3 py-2 rounded-lg border-2 text-center",
          overdue 
            ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" 
            : "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
        )}>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5 whitespace-nowrap">
            Due Date
          </div>
          <div className={cn(
            "text-sm font-bold whitespace-nowrap",
            overdue ? "text-red-700 dark:text-red-400" : "text-blue-700 dark:text-blue-400"
          )}>
            {new Date(recurringTransaction.nextDueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
        </div>
      </div>

      {/* Amount and Actions - 30% */}
      <div className="flex items-center justify-end gap-4 w-[30%]">
        {/* Amount */}
        <div className="text-right">
          <p className={cn(
            "text-lg font-semibold",
            isIncome ? 'text-green-600' :
            isExpense ? 'text-red-600' :
            'text-blue-600'
          )}>
            {isIncome ? '+' : isExpense ? '-' : ''}
            {formatCurrency(recurringTransaction.amount, recurringTransaction.currency)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {showExecute ? (
            <>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={loading}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {loading ? 'Executing...' : 'Execute'}
              </Button>

              <AnimatePresence>
                {showActions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(recurringTransaction)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(recurringTransaction._id.toString())}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(recurringTransaction)}
                className="gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
              <AnimatePresence>
                {showActions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(recurringTransaction._id.toString())}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
