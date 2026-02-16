'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Sidebar } from '@/components/layout/sidebar'
import { AccountFormModal, AccountFormData } from '@/components/accounts/account-form-modal'
import { DeleteAccountDialog } from '@/components/accounts/delete-account-dialog'
import { AuthUser } from '@/lib/auth'
import { Account } from '@/lib/types'
import { toast } from 'sonner'
import { onAccountUpdate } from '@/lib/events/account-events'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: AuthUser
  onAccountClick?: (accountId: string) => void
}

export function DashboardLayout({ children, user, onAccountClick }: DashboardLayoutProps) {
  const router = useRouter()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal states
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      
      if (data.success) {
        setAccounts(data.data.accounts)
        setTotalBalance(data.data.totalBalance)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Failed to load accounts')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
    
    // Listen for account update events from other components
    const unsubscribe = onAccountUpdate(() => {
      fetchAccounts()
    })
    
    return unsubscribe
  }, [])

  const handleAddAccount = () => {
    setSelectedAccount(null)
    setIsAccountFormOpen(true)
  }

  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account)
    setIsAccountFormOpen(true)
  }

  const handleDeleteAccount = (account: Account) => {
    setSelectedAccount(account)
    setIsDeleteDialogOpen(true)
  }

  const handleAccountFormSubmit = async (data: AccountFormData) => {
    try {
      const url = selectedAccount 
        ? `/api/accounts/${selectedAccount._id.toString()}`
        : '/api/accounts'
      
      const method = selectedAccount ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        toast.success(selectedAccount ? 'Account updated successfully' : 'Account created successfully')
        await fetchAccounts()
      } else {
        toast.error(result.error || 'Failed to save account')
      }
    } catch (error) {
      console.error('Error saving account:', error)
      toast.error('Failed to save account')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedAccount) return

    try {
      const response = await fetch(`/api/accounts/${selectedAccount._id.toString()}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Account deleted successfully')
        await fetchAccounts()
      } else {
        toast.error(result.error || 'Failed to delete account')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Failed to delete account')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:supports-[backdrop-filter]:bg-gray-900/75">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500">
              <span className="text-white font-bold text-lg">SW</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
                SmartWealth
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
                Personal Finance Manager
              </p>
            </div>
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">User</p>
            </div>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/profile')}
              className="gap-2"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          accounts={accounts}
          totalBalance={totalBalance}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onAddAccount={handleAddAccount}
          onEditAccount={handleEditAccount}
          onDeleteAccount={handleDeleteAccount}
          onRefresh={fetchAccounts}
          onAccountClick={onAccountClick}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {children}
        </main>
      </div>

      {/* Modals */}
      <AccountFormModal
        open={isAccountFormOpen}
        onOpenChange={setIsAccountFormOpen}
        account={selectedAccount}
        onSubmit={handleAccountFormSubmit}
      />

      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        account={selectedAccount}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
