'use client'

import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CustomSelectOption {
  value: string
  label: string
}

export interface CustomSelectGroup {
  label: string
  options: CustomSelectOption[]
}

export interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  groups: CustomSelectGroup[]
  placeholder?: string
  className?: string
  id?: string
}

export function CustomSelect({ 
  value, 
  onChange, 
  groups, 
  placeholder = 'Select an option',
  className,
  id
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Find selected option label
  const selectedLabel = React.useMemo(() => {
    for (const group of groups) {
      const option = group.options.find(opt => opt.value === value)
      if (option) return option.label
    }
    return placeholder
  }, [value, groups, placeholder])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn("relative", className)} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 dark:border-gray-700 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {selectedLabel}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 text-gray-500 transition-transform",
          isOpen && "transform rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[200] w-full mt-1 rounded-md border border-gray-300 bg-white shadow-lg py-1">
          {groups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Group Header */}
              <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-white">
                {group.label}
              </div>
              
              {/* Group Options */}
              <div>
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full flex items-center px-6 py-1.5 text-sm text-left text-gray-900 hover:bg-gray-100 transition-colors bg-white",
                      value === option.value && "bg-primary-600 text-white hover:bg-primary-700"
                    )}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
