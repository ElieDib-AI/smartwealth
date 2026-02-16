import { ObjectId } from 'mongodb'

// Subscription types
export type SubscriptionTier = 'free' | 'premium'
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'trial'
export type PaymentProvider = 'stripe' | 'manual' | 'trial'

export interface Subscription {
  _id: ObjectId
  userId: ObjectId
  tier: SubscriptionTier
  status: SubscriptionStatus
  provider: PaymentProvider
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  startDate: Date
  endDate: Date
  canceledAt?: Date
  trialEndsAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface SubscriptionLimits {
  maxFeature1: number
  maxFeature2: number
  feature3Enabled: boolean
  feature4Enabled: boolean
  prioritySupport: boolean
}

// User types
export interface User {
  _id: ObjectId
  email: string
  password: string // bcrypt hashed
  name: string
  createdAt: Date
  subscriptionTier: SubscriptionTier
  subscriptionStatus: SubscriptionStatus
  subscriptionId?: ObjectId // reference to subscriptions collection
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  trialEndsAt?: Date
  emailVerified?: boolean
  updatedAt?: Date
}

// Account types
export type AccountCategory = 'bank' | 'credit_loans' | 'investments' | 'assets'

export type AccountType = 
  // Bank Accounts
  | 'checking' 
  | 'savings' 
  | 'cash'
  // Credit & Loans
  | 'credit_card'
  | 'personal_loan'
  | 'mortgage'
  | 'car_loan'
  | 'student_loan'
  // Investments
  | 'stocks'
  | 'retirement'
  | 'crypto'
  | 'mutual_funds'
  // Assets
  | 'real_estate'
  | 'vehicle'
  | 'valuables'
  | 'other_assets'

export interface Account {
  _id: ObjectId
  userId: ObjectId
  name: string
  type: AccountType
  category: AccountCategory
  balance: number
  currency: string
  institution?: string
  color: string // for visual identification
  icon: string // lucide icon name
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Transaction types
export type TransactionType = 'expense' | 'income' | 'transfer'
export type TransactionStatus = 'completed' | 'pending' | 'cancelled'

export interface CurrencyConversion {
  fromCurrency: string
  toCurrency: string
  fromAmount: number
  toAmount: number
  exchangeRate: number
  conversionDate: Date
}

export interface Transaction {
  _id: ObjectId
  userId: ObjectId
  type: TransactionType
  
  // Amount & Currency
  amount: number                // Amount in original currency
  currency: string              // Original currency (AED, USD, EUR, etc.)
  
  // Multi-currency support (for reporting and conversions)
  originalAmount?: number       // Amount in original currency (same as amount for backward compatibility)
  originalCurrency?: string     // Original currency (same as currency for backward compatibility)
  usdAmount?: number           // USD equivalent for cross-currency reporting
  exchangeRate?: number        // Exchange rate used (original to USD)
  
  // Account References
  accountId: ObjectId           // Source account for expense/transfer, destination for income
  toAccountId?: ObjectId        // Only for transfers
  toAccountName?: string        // Enriched field: name of the transfer destination account
  transferDirection?: 'in' | 'out' // For transfers: 'out' = money leaving accountId, 'in' = money entering accountId
  
  // Categorization
  category: string              // Category name (predefined or custom)
  subcategory?: string          // Optional subcategory
  
  // Description & Metadata
  description: string
  notes?: string
  tags?: string[]               // For flexible filtering/grouping
  
  // Date & Time
  date: Date                    // Transaction date (can be backdated)
  createdAt: Date
  updatedAt: Date
  
  // Status & Tracking
  status: TransactionStatus
  
  // Running Balance
  runningBalance?: number       // Account balance AFTER this transaction
  
  // Currency Conversion (for transfers between different currencies)
  currencyConversion?: CurrencyConversion
  
  // Future-proofing
  isRecurring?: boolean         // For future recurring transactions
  recurringId?: ObjectId        // Link to recurring template
  attachments?: string[]        // For future receipt uploads
  splitTransactionId?: ObjectId // For future split transactions
}

export interface CustomCategory {
  _id: ObjectId
  userId: ObjectId
  name: string
  type: 'expense' | 'income'
  icon?: string                 // Emoji or lucide icon
  color?: string
  subcategories?: string[]
  createdAt: Date
}

// Recurring Transaction types
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannually' | 'yearly' | 'custom'
export type RecurringIntervalUnit = 'days' | 'weeks' | 'months'

// Split Transaction types (for loan payments, etc.)
export type SplitType = 'expense' | 'transfer'

export interface SplitPart {
  type: SplitType
  amount: number
  category: string
  toAccountId?: ObjectId        // For transfer splits
  description?: string          // Optional description for this part
}

export interface RecurringTransaction {
  _id: ObjectId
  userId: ObjectId
  type: TransactionType
  
  // Amount & Currency
  amount: number
  currency: string
  
  // Account References
  accountId: ObjectId           // Source account for expense/transfer, destination for income
  toAccountId?: ObjectId        // Only for transfers (when not split)
  
  // Categorization
  category: string
  subcategory?: string
  
  // Description
  description: string
  notes?: string
  
  // Split Transaction Support
  isSplit?: boolean             // Whether this is a split transaction
  splits?: SplitPart[]          // Array of split parts (e.g., principal + interest)
  
  // Loan Payment Fields (only for loan_payment type)
  loanDetails?: {
    originalAmount: number      // Original loan amount
    interestRate: number         // Annual interest rate (e.g., 5.5 for 5.5%)
    termMonths: number           // Loan term in months
    startDate: Date              // When loan started
    currentBalance?: number      // Calculated remaining balance
    lastCalculatedAt?: Date      // When balance was last calculated
  }
  
  // Frequency Configuration
  frequency: RecurringFrequency
  interval?: number             // For custom: every X days/weeks/months
  intervalUnit?: RecurringIntervalUnit  // For custom frequency
  
  // Scheduling
  startDate: Date
  nextDueDate: Date
  endDate?: Date                // Optional end date
  
  // Status
  isActive: boolean
  
  // Metadata
  createdAt: Date
  updatedAt: Date
  lastExecutedAt?: Date
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

