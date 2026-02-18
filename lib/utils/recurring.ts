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
 * Calculate the initial next due date for a new recurring transaction
 * If start date is in the past, this will be the start date itself (to show as overdue)
 * If start date is in the future, this will be the start date
 */
export function calculateInitialNextDueDate(
  startDate: Date,
  frequency: RecurringFrequency,
  interval?: number,
  intervalUnit?: RecurringIntervalUnit
): Date {
  // Always return the start date as the first due date
  // This allows past dates to show as overdue
  return new Date(startDate)
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

/**
 * Generate all occurrences of a recurring transaction
 * Shows ALL past unexecuted occurrences + future occurrences up to 1 year from today
 * 
 * Note: We generate all occurrences from start date and let the UI/backend filter
 * based on actual executed transactions, not just lastExecutedAt.
 */
export function generateOccurrences(
  startDate: Date,
  frequency: RecurringFrequency,
  interval?: number,
  intervalUnit?: RecurringIntervalUnit,
  endDate?: Date,
  lastExecutedAt?: Date,
  skippedDates?: Date[]
): Date[] {
  const occurrences: Date[] = []
  
  // Get today in UTC to avoid timezone issues
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  
  const oneYearFromNow = new Date(todayUTC)
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
  
  // Start from the start date (keep as UTC)
  let currentDate = new Date(startDate)
  
  // Generate occurrences up to 1 year from now or end date (whichever is earlier)
  const maxDate = endDate && new Date(endDate) < oneYearFromNow ? new Date(endDate) : oneYearFromNow
  
  // Convert skipped dates to ISO strings for comparison
  const skippedDatesISO = new Set(
    (skippedDates || []).map(date => new Date(date).toISOString())
  )
  
  // Limit to 100 occurrences to prevent infinite loops
  let count = 0
  const maxOccurrences = 100
  
  while (currentDate <= maxDate && count < maxOccurrences) {
    const currentDateISO = new Date(currentDate).toISOString()
    
    // Only add if not in skipped dates
    if (!skippedDatesISO.has(currentDateISO)) {
      occurrences.push(new Date(currentDate))
    }
    
    currentDate = calculateNextDueDate(currentDate, frequency, interval, intervalUnit)
    count++
  }
  
  return occurrences
}
