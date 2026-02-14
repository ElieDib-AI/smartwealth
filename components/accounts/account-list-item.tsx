'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wallet, 
  PiggyBank, 
  CreditCard, 
  TrendingUp, 
  Banknote,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react'
import { Account } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AccountListItemProps {
  account: Account
  isCollapsed: boolean
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

const accountIcons = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  cash: Banknote
}

const accountGradients = {
  checking: 'from-cyan-600 to-blue-500',
  savings: 'from-emerald-600 to-green-500',
  credit: 'from-amber-600 to-orange-500',
  investment: 'from-indigo-600 to-purple-500',
  cash: 'from-gray-600 to-gray-500'
}

export function AccountListItem({ 
  account, 
  isCollapsed, 
  onEdit, 
  onDelete 
}: AccountListItemProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showActions, setShowActions] = useState(false)
  
  const Icon = accountIcons[account.type] || Wallet
  const gradient = accountGradients[account.type] || accountGradients.checking
  
  const isActive = pathname === `/dashboard/accounts/${account._id.toString()}`

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account.currency || 'USD'
    }).format(amount)
  }

  const handleClick = () => {
    router.push(`/dashboard/accounts/${account._id.toString()}`)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowActions(false)
    onEdit(account)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowActions(false)
    onDelete(account)
  }

  const toggleActions = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowActions(!showActions)
  }

  return (
    <div className="relative">
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => !isCollapsed && setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative",
          isActive 
            ? "bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-600/20" 
            : "hover:bg-gray-100 dark:hover:bg-gray-800",
          isCollapsed && "justify-center"
        )}
        title={isCollapsed ? `${account.name}: ${formatCurrency(account.balance)}` : undefined}
      >
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
          gradient
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>

        {/* Account Info */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {account.name}
              </p>
              <p className={cn(
                "text-xs font-semibold",
                account.balance >= 0 
                  ? "text-green-600 dark:text-green-400" 
                  : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrency(account.balance)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions Button */}
        <AnimatePresence mode="wait">
          {!isCollapsed && showActions && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={toggleActions}
              className="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Actions Menu */}
      <AnimatePresence>
        {showActions && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-3 top-full mt-1 z-20 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
          >
            <button
              onClick={handleEdit}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
