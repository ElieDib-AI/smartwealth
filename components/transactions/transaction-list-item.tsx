'use client'

import { Transaction } from '@/lib/types'
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Edit2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface TransactionListItemProps {
  transaction: Transaction
  accountName?: string
  toAccountName?: string
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}

export function TransactionListItem({
  transaction,
  accountName,
  toAccountName,
  onEdit,
  onDelete
}: TransactionListItemProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount)
  }

  const getTypeIcon = () => {
    switch (transaction.type) {
      case 'income':
        return <ArrowDownLeft className="h-5 w-5 text-green-600" />
      case 'expense':
        return <ArrowUpRight className="h-5 w-5 text-red-600" />
      case 'transfer':
        return <ArrowLeftRight className="h-5 w-5 text-blue-600" />
    }
  }

  const getTypeColor = () => {
    switch (transaction.type) {
      case 'income':
        return 'text-green-600 dark:text-green-400'
      case 'expense':
        return 'text-red-600 dark:text-red-400'
      case 'transfer':
        return 'text-blue-600 dark:text-blue-400'
    }
  }

  const getAmountDisplay = () => {
    const amount = formatCurrency(transaction.amount, transaction.currency)
    switch (transaction.type) {
      case 'income':
        return `+${amount}`
      case 'expense':
        return `-${amount}`
      case 'transfer':
        return amount
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow group">
      <div className="flex items-center gap-4 flex-1">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          {getTypeIcon()}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {transaction.description}
            </h3>
            {transaction.status === 'pending' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                Pending
              </span>
            )}
            {transaction.status === 'cancelled' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 rounded">
                Cancelled
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{transaction.category}</span>
            {transaction.subcategory && (
              <>
                <span>•</span>
                <span>{transaction.subcategory}</span>
              </>
            )}
            {accountName && (
              <>
                <span>•</span>
                <span>{accountName}</span>
              </>
            )}
            {transaction.type === 'transfer' && toAccountName && (
              <>
                <span>→</span>
                <span>{toAccountName}</span>
              </>
            )}
          </div>

          {transaction.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {transaction.notes}
            </p>
          )}

          {transaction.tags && transaction.tags.length > 0 && (
            <div className="flex gap-1 mt-2">
              {transaction.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Amount and Date */}
      <div className="flex items-center gap-4 ml-4">
        <div className="text-right">
          <p className={`text-lg font-bold ${getTypeColor()}`}>
            {getAmountDisplay()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {format(new Date(transaction.date), 'MMM d, yyyy')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(transaction)}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Edit transaction"
          >
            <Edit2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={() => onDelete(transaction)}
            className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete transaction"
          >
            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
