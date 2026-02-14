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

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
