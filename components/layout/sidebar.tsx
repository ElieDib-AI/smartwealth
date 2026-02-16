'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Home,
  Wallet,
  TrendingUp,
  Target,
  Receipt,
  PieChart,
  Repeat
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Account } from '@/lib/types'
import { AccountListItem } from '@/components/accounts/account-list-item'
import { cn } from '@/lib/utils'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'

interface SidebarProps {
  accounts: Account[]
  totalBalance: number
  isCollapsed: boolean
  onToggle: () => void
  onAddAccount: () => void
  onEditAccount: (account: Account) => void
  onDeleteAccount: (account: Account) => void
  onHideAccount: (account: Account) => void
  onRefresh: () => void
  onAccountClick?: (accountId: string) => void
}

const navigationItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Wallet, label: 'Accounts', href: '/dashboard/accounts' },
  { icon: Receipt, label: 'Transactions', href: '/dashboard/transactions' },
  { icon: Repeat, label: 'Recurring', href: '/dashboard/recurring' },
  { icon: PieChart, label: 'Budgets', href: '/dashboard/budgets' },
  { icon: Target, label: 'Goals', href: '/dashboard/goals' },
  { icon: TrendingUp, label: 'Reports', href: '/dashboard/reports' },
]

export function Sidebar({
  accounts,
  totalBalance,
  isCollapsed,
  onToggle,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onHideAccount,
  onRefresh,
  onAccountClick
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [localAccounts, setLocalAccounts] = useState<Account[]>(accounts)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setLocalAccounts(accounts)
  }, [accounts])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = localAccounts.findIndex((acc) => acc._id.toString() === active.id)
    const newIndex = localAccounts.findIndex((acc) => acc._id.toString() === over.id)

    const newOrder = arrayMove(localAccounts, oldIndex, newIndex)
    setLocalAccounts(newOrder)

    // Update order in backend
    try {
      const response = await fetch('/api/accounts/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds: newOrder.map(acc => acc._id.toString())
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      toast.success('Account order updated')
      onRefresh()
    } catch (error) {
      console.error('Error updating account order:', error)
      toast.error('Failed to update account order')
      setLocalAccounts(accounts) // Revert on error
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (!mounted) return null

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative h-full border-r border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:supports-[backdrop-filter]:bg-gray-900/75 flex flex-col"
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* Sidebar Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        {/* Total Balance */}
        <div className="px-3 mb-4">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-4 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 text-white"
              >
                <p className="text-xs font-medium opacity-90 mb-1">Total Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
              </motion.div>
            ) : (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-center"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="px-3 mb-4">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Navigation
              </motion.p>
            )}
          </AnimatePresence>
          
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isActive 
                      ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400" 
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                    isCollapsed && "justify-center"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <AnimatePresence mode="wait">
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Accounts Section */}
        <div className="px-3">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between px-3 mb-2"
              >
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Accounts
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {accounts.length}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1">
            {localAccounts.length === 0 ? (
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center"
                  >
                    No accounts yet
                  </motion.p>
                )}
              </AnimatePresence>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localAccounts.map(acc => acc._id.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  {localAccounts.map((account) => (
                    <AccountListItem
                      key={account._id.toString()}
                      account={account}
                      isCollapsed={isCollapsed}
                      onEdit={onEditAccount}
                      onDelete={onDeleteAccount}
                      onHide={onHideAccount}
                      onClick={onAccountClick ? () => onAccountClick(account._id.toString()) : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Add Account Button */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <Button
          onClick={onAddAccount}
          className={cn(
            "w-full gap-2",
            isCollapsed && "px-2"
          )}
          title={isCollapsed ? "Add Account" : undefined}
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Add Account
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.aside>
  )
}
