import { RecurringFrequency, RecurringIntervalUnit } from '@/lib/types'

/**
 * Calculate the next due date based on frequency
 */
export function calculateNextDueDate(
  currentDueDate: Date,
  frequency: RecurringFrequency,
  interval?: number,
  intervalUnit?: RecurringIntervalUnit
): Date {
  const nextDate = new Date(currentDueDate)
  
  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1)
      break
      
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7)
      break
      
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14)
      break
      
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1)
      break
      
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3)
      break
      
    case 'semiannually':
      nextDate.setMonth(nextDate.getMonth() + 6)
      break
      
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      break
      
    case 'custom':
      if (!interval || !intervalUnit) {
        throw new Error('Custom frequency requires interval and intervalUnit')
      }
      
      switch (intervalUnit) {
        case 'days':
          nextDate.setDate(nextDate.getDate() + interval)
          break
        case 'weeks':
          nextDate.setDate(nextDate.getDate() + (interval * 7))
          break
        case 'months':
          nextDate.setMonth(nextDate.getMonth() + interval)
          break
      }
      break
  }
  
  return nextDate
}

/**
 * Get human-readable frequency label
 */
export function getFrequencyLabel(
  frequency: RecurringFrequency,
  interval?: number,
  intervalUnit?: RecurringIntervalUnit
): string {
  switch (frequency) {
    case 'daily':
      return 'Daily'
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
      return 'Bi-weekly'
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'semiannually':
      return 'Semi-annually'
    case 'yearly':
      return 'Yearly'
    case 'custom':
      if (!interval || !intervalUnit) {
        return 'Custom'
      }
      const unit = intervalUnit === 'days' ? 'day' : 
                   intervalUnit === 'weeks' ? 'week' : 'month'
      return `Every ${interval} ${unit}${interval > 1 ? 's' : ''}`
    default:
      return 'Unknown'
  }
}

/**
 * Calculate days until next due date
 */
export function getDaysUntilDue(nextDueDate: Date): number {
  const now = new Date()
  const due = new Date(nextDueDate)
  const diffTime = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Check if a recurring transaction is overdue
 */
export function isOverdue(nextDueDate: Date): boolean {
  return getDaysUntilDue(nextDueDate) < 0
}

/**
 * Format due date for display
 */
export function formatDueDate(nextDueDate: Date): string {
  const daysUntil = getDaysUntilDue(nextDueDate)
  
  if (daysUntil < 0) {
    return `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? 's' : ''}`
  } else if (daysUntil === 0) {
    return 'Due today'
  } else if (daysUntil === 1) {
    return 'Due tomorrow'
  } else if (daysUntil <= 7) {
    return `Due in ${daysUntil} days`
  } else {
    return new Date(nextDueDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
}
