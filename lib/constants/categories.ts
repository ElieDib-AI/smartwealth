export interface CategoryDefinition {
  name: string
  icon: string
  subcategories?: string[]
}

export const EXPENSE_CATEGORIES: CategoryDefinition[] = [
  {
    name: 'Food & Dining',
    icon: '🍔',
    subcategories: ['Groceries', 'Restaurants', 'Coffee', 'Fast Food']
  },
  {
    name: 'Transportation',
    icon: '🚗',
    subcategories: ['Fuel', 'Public Transit', 'Parking', 'Maintenance']
  },
  {
    name: 'Housing',
    icon: '🏠',
    subcategories: ['Rent', 'Mortgage', 'Utilities', 'Maintenance', 'Insurance']
  },
  {
    name: 'Shopping',
    icon: '🛍️',
    subcategories: ['Clothing', 'Electronics', 'Home Goods', 'Personal Care']
  },
  {
    name: 'Healthcare',
    icon: '💊',
    subcategories: ['Doctor', 'Pharmacy', 'Insurance', 'Dental']
  },
  {
    name: 'Entertainment',
    icon: '🎬',
    subcategories: ['Movies', 'Streaming', 'Hobbies', 'Events']
  },
  {
    name: 'Travel',
    icon: '✈️',
    subcategories: ['Flights', 'Hotels', 'Activities']
  },
  {
    name: 'Education',
    icon: '📚',
    subcategories: ['Tuition', 'Books', 'Courses']
  },
  {
    name: 'Bills & Fees',
    icon: '💳',
    subcategories: ['Phone', 'Internet', 'Subscriptions', 'Bank Fees']
  },
  {
    name: 'Gifts & Donations',
    icon: '🎁',
    subcategories: []
  },
  {
    name: 'Family & Personal',
    icon: '👨‍👩‍👧',
    subcategories: []
  },
  {
    name: 'Other Expenses',
    icon: '📊',
    subcategories: []
  }
]

export const INCOME_CATEGORIES: CategoryDefinition[] = [
  {
    name: 'Salary & Wages',
    icon: '💼',
    subcategories: []
  },
  {
    name: 'Business Income',
    icon: '💰',
    subcategories: []
  },
  {
    name: 'Investment Returns',
    icon: '📈',
    subcategories: ['Dividends', 'Interest', 'Capital Gains']
  },
  {
    name: 'Gifts Received',
    icon: '🎁',
    subcategories: []
  },
  {
    name: 'Refunds & Reimbursements',
    icon: '💵',
    subcategories: []
  },
  {
    name: 'Bonuses & Awards',
    icon: '🏆',
    subcategories: []
  },
  {
    name: 'Other Income',
    icon: '📊',
    subcategories: []
  }
]

export const TRANSFER_CATEGORY: CategoryDefinition = {
  name: 'Account Transfer',
  icon: '🔄',
  subcategories: []
}

// Helper function to get all category names
export function getAllCategoryNames(type: 'expense' | 'income'): string[] {
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  return categories.map(cat => cat.name)
}

// Helper function to get category by name
export function getCategoryByName(name: string, type: 'expense' | 'income'): CategoryDefinition | undefined {
  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
  return categories.find(cat => cat.name === name)
}

// Helper function to validate if a category exists
export function isValidCategory(name: string, type: 'expense' | 'income'): boolean {
  return getAllCategoryNames(type).includes(name)
}
