/**
 * Loan Calculator Utility
 * 
 * Provides amortization calculations for loan payments including:
 * - Monthly payment calculation
 * - Payment breakdown (principal vs interest)
 * - Full amortization schedule generation
 * - Current balance calculation
 */

export interface PaymentBreakdown {
  paymentNumber: number
  paymentDate: Date
  totalPayment: number
  principal: number
  interest: number
  remainingBalance: number
}

/**
 * Calculate the fixed monthly payment for a loan
 * 
 * Formula: P * [r(1+r)^n] / [(1+r)^n - 1]
 * where:
 * - P = principal (loan amount)
 * - r = monthly interest rate (annual rate / 12 / 100)
 * - n = number of payments (term in months)
 * 
 * @param principal - Original loan amount
 * @param annualRate - Annual interest rate as percentage (e.g., 5.5 for 5.5%)
 * @param termMonths - Loan term in months
 * @returns Monthly payment amount
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) {
    return 0
  }

  // Handle 0% interest rate
  if (annualRate === 0) {
    return principal / termMonths
  }

  const monthlyRate = annualRate / 12 / 100
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, termMonths)
  const denominator = Math.pow(1 + monthlyRate, termMonths) - 1
  
  return principal * (numerator / denominator)
}

/**
 * Calculate the breakdown of a specific payment
 * 
 * @param originalAmount - Original loan amount
 * @param annualRate - Annual interest rate as percentage
 * @param termMonths - Loan term in months
 * @param paymentNumber - Which payment (1-indexed)
 * @param currentBalance - Optional: current balance if known (for accuracy)
 * @returns Payment breakdown with principal, interest, and remaining balance
 */
export function calculatePaymentBreakdown(
  originalAmount: number,
  annualRate: number,
  termMonths: number,
  paymentNumber: number,
  currentBalance?: number
): PaymentBreakdown {
  const monthlyPayment = calculateMonthlyPayment(originalAmount, annualRate, termMonths)
  const monthlyRate = annualRate / 12 / 100

  // If current balance is provided, use it; otherwise calculate it
  let balance = currentBalance ?? calculateCurrentBalance(
    originalAmount,
    annualRate,
    termMonths,
    paymentNumber - 1
  )

  // Calculate interest for this payment
  const interest = balance * monthlyRate
  
  // Calculate principal (remaining after interest)
  const principal = Math.min(monthlyPayment - interest, balance)
  
  // Calculate new balance
  const remainingBalance = Math.max(0, balance - principal)

  return {
    paymentNumber,
    paymentDate: new Date(), // Will be set by caller
    totalPayment: principal + interest,
    principal,
    interest,
    remainingBalance
  }
}

/**
 * Calculate the remaining balance after a certain number of payments
 * 
 * @param originalAmount - Original loan amount
 * @param annualRate - Annual interest rate as percentage
 * @param termMonths - Loan term in months
 * @param paymentsMade - Number of payments already made
 * @returns Remaining balance
 */
export function calculateCurrentBalance(
  originalAmount: number,
  annualRate: number,
  termMonths: number,
  paymentsMade: number
): number {
  if (paymentsMade <= 0) {
    return originalAmount
  }

  if (paymentsMade >= termMonths) {
    return 0
  }

  const monthlyPayment = calculateMonthlyPayment(originalAmount, annualRate, termMonths)
  const monthlyRate = annualRate / 12 / 100

  let balance = originalAmount

  // Iterate through each payment to calculate remaining balance
  for (let i = 0; i < paymentsMade; i++) {
    const interest = balance * monthlyRate
    const principal = monthlyPayment - interest
    balance = Math.max(0, balance - principal)
  }

  return balance
}

/**
 * Generate a complete amortization schedule for the loan
 * 
 * @param originalAmount - Original loan amount
 * @param annualRate - Annual interest rate as percentage
 * @param termMonths - Loan term in months
 * @param startDate - When the loan started
 * @returns Array of payment breakdowns for the entire loan term
 */
export function generateAmortizationSchedule(
  originalAmount: number,
  annualRate: number,
  termMonths: number,
  startDate: Date
): PaymentBreakdown[] {
  const schedule: PaymentBreakdown[] = []
  const monthlyPayment = calculateMonthlyPayment(originalAmount, annualRate, termMonths)
  const monthlyRate = annualRate / 12 / 100

  let balance = originalAmount
  const loanStartDate = new Date(startDate)

  for (let i = 1; i <= termMonths; i++) {
    const interest = balance * monthlyRate
    const principal = Math.min(monthlyPayment - interest, balance)
    balance = Math.max(0, balance - principal)

    // Calculate payment date (add i months to start date)
    const paymentDate = new Date(loanStartDate)
    paymentDate.setMonth(paymentDate.getMonth() + i)

    schedule.push({
      paymentNumber: i,
      paymentDate,
      totalPayment: principal + interest,
      principal,
      interest,
      remainingBalance: balance
    })

    // Break if loan is paid off
    if (balance === 0) {
      break
    }
  }

  return schedule
}

/**
 * Calculate how many payments have been made based on dates
 * 
 * @param loanStartDate - When the loan started
 * @param currentDate - Current date (or date to calculate from)
 * @param frequency - Payment frequency (default: monthly)
 * @returns Number of payments that should have been made
 */
export function calculatePaymentsMade(
  loanStartDate: Date,
  currentDate: Date = new Date(),
  frequency: 'monthly' | 'biweekly' | 'weekly' = 'monthly'
): number {
  const start = new Date(loanStartDate)
  const current = new Date(currentDate)

  if (current <= start) {
    return 0
  }

  switch (frequency) {
    case 'monthly': {
      const months = (current.getFullYear() - start.getFullYear()) * 12 + 
                     (current.getMonth() - start.getMonth())
      return Math.max(0, months)
    }
    case 'biweekly': {
      const days = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      return Math.floor(days / 14)
    }
    case 'weekly': {
      const days = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      return Math.floor(days / 7)
    }
    default:
      return 0
  }
}

/**
 * Get the next payment breakdown for a loan
 * Useful for showing what the next payment will look like
 * 
 * @param loanDetails - Loan details object
 * @param lastExecutedAt - When the last payment was executed
 * @returns Next payment breakdown
 */
export function getNextPaymentBreakdown(
  loanDetails: {
    originalAmount: number
    interestRate: number
    termMonths: number
    startDate: Date
    currentBalance?: number
  },
  lastExecutedAt?: Date
): PaymentBreakdown {
  const paymentsMade = lastExecutedAt 
    ? calculatePaymentsMade(loanDetails.startDate, lastExecutedAt)
    : 0

  const nextPaymentNumber = paymentsMade + 1

  return calculatePaymentBreakdown(
    loanDetails.originalAmount,
    loanDetails.interestRate,
    loanDetails.termMonths,
    nextPaymentNumber,
    loanDetails.currentBalance
  )
}
