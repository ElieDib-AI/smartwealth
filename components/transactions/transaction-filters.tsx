'use client'

import { useState } from 'react'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Account, TransactionType } from '@/lib/types'
import { X } from 'lucide-react'

interface TransactionFiltersProps {
  accounts: Account[]
  categories: string[]
  onFilterChange: (filters: FilterValues) => void
}

export interface FilterValues {
  accountId?: string
  type?: TransactionType
  category?: string
  startDate?: string
  endDate?: string
  search?: string
}

export function TransactionFilters({
  accounts,
  categories,
  onFilterChange
}: TransactionFiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({})

  const handleFilterChange = (key: keyof FilterValues, value: string) => {
    const newFilters = {
      ...filters,
      [key]: value || undefined
    }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    setFilters({})
    onFilterChange({})
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Search */}
        <div>
          <Label htmlFor="search" className="text-xs">Search</Label>
          <Input
            id="search"
            type="text"
            placeholder="Description..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="mt-1"
          />
        </div>

        {/* Account */}
        <div>
          <Label htmlFor="account" className="text-xs">Account</Label>
          <Select
            id="account"
            value={filters.accountId || ''}
            onChange={(e) => handleFilterChange('accountId', e.target.value)}
            className="mt-1"
          >
            <option value="">All accounts</option>
            {Array.isArray(accounts) && accounts.map((account) => (
              <option key={account._id.toString()} value={account._id.toString()}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Type */}
        <div>
          <Label htmlFor="type" className="text-xs">Type</Label>
          <Select
            id="type"
            value={filters.type || ''}
            onChange={(e) => handleFilterChange('type', e.target.value as TransactionType)}
            className="mt-1"
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </Select>
        </div>

        {/* Category */}
        <div>
          <Label htmlFor="category" className="text-xs">Category</Label>
          <Select
            id="category"
            value={filters.category || ''}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="mt-1"
          >
            <option value="">All categories</option>
            {Array.isArray(categories) && categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </div>

        {/* Start Date */}
        <div>
          <Label htmlFor="startDate" className="text-xs">From</Label>
          <Input
            id="startDate"
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="mt-1"
          />
        </div>

        {/* End Date */}
        <div>
          <Label htmlFor="endDate" className="text-xs">To</Label>
          <Input
            id="endDate"
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  )
}
