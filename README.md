# SmartWealth - Personal Finance Management

Welcome to **SmartWealth**! This is your personal finance management application, built from the Fundamental SaaS template.

## 🎯 What is SmartWealth?

SmartWealth is a personal finance application designed to help you manage your money, track expenses, and achieve your financial goals.

## ✅ What's Already Set Up

All the infrastructure from the Fundamental template has been copied and rebranded:

- ✅ **Authentication System** - Signup, login, email verification
- ✅ **Database** - MongoDB integration ready
- ✅ **Payments** - Stripe subscription system
- ✅ **Theme System** - Light/dark mode
- ✅ **UI Components** - Button, Card, Theme Toggle
- ✅ **Email Service** - Nodemailer for verification emails
- ✅ **Landing Page** - Hero, features, pricing
- ✅ **Dashboard** - Protected user dashboard
- ✅ **Profile Page** - User settings and subscription management

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd /Users/eliedib/cursor/smartwealth
npm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=smartwealth

# Authentication
JWT_SECRET=your_random_secret_here

# Email (use Gmail or SendGrid)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@smartwealth.com

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## 💡 Next Steps - Build SmartWealth Features

Now that you have the foundation, here are the features you should build for SmartWealth:

### Core Features to Build

1. **Dashboard Overview**
   - Total balance display
   - Income vs Expenses chart
   - Recent transactions list
   - Budget progress bars

2. **Accounts Management**
   - Add/edit bank accounts
   - Credit cards tracking
   - Investment accounts
   - Account balance history

3. **Transactions**
   - Manual transaction entry
   - Categorization (Food, Transport, Entertainment, etc.)
   - Search and filter
   - Bulk import from CSV

4. **Budgets**
   - Set monthly budgets by category
   - Track spending vs budget
   - Alerts when approaching limits
   - Budget recommendations

5. **Reports & Analytics**
   - Spending trends over time
   - Category breakdown pie charts
   - Income vs expenses comparison
   - Net worth tracking

6. **Goals**
   - Savings goals (vacation, emergency fund, etc.)
   - Progress tracking
   - Goal recommendations
   - Milestone celebrations

7. **Bills & Subscriptions**
   - Recurring bills tracking
   - Payment reminders
   - Subscription management
   - Upcoming payments calendar

## 🎨 Customization

### Change Primary Color

SmartWealth currently uses Emerald green. To change to a finance-themed color:

Edit `app/globals.css`:

```css
@theme {
  /* Example: Blue for trust and stability */
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  /* Update all primary-* values */
}
```

**Recommended colors for finance apps:**
- Blue (trust): `#2563eb`
- Green (growth): `#059669` (current)
- Purple (premium): `#7c3aed`

### Update Logo

Replace the "F" in the logo with "SW" or your custom icon:

1. Edit `components/layout/dashboard-layout.tsx`
2. Edit `app/page.tsx` (landing page)
3. Update the logo div content

## 📊 Database Schema Suggestions

For SmartWealth, you'll want to add these collections:

```typescript
// accounts collection
{
  userId: ObjectId,
  name: string,
  type: 'checking' | 'savings' | 'credit' | 'investment',
  balance: number,
  currency: string,
  createdAt: Date
}

// transactions collection
{
  userId: ObjectId,
  accountId: ObjectId,
  amount: number,
  category: string,
  description: string,
  date: Date,
  type: 'income' | 'expense',
  createdAt: Date
}

// budgets collection
{
  userId: ObjectId,
  category: string,
  amount: number,
  period: 'monthly' | 'yearly',
  startDate: Date,
  endDate: Date
}

// goals collection
{
  userId: ObjectId,
  name: string,
  targetAmount: number,
  currentAmount: number,
  deadline: Date,
  createdAt: Date
}
```

## 🔐 Security Notes

- All authentication is already secure (JWT, httpOnly cookies)
- Financial data should be encrypted at rest
- Consider adding 2FA for premium users
- Implement rate limiting on sensitive endpoints
- Regular security audits recommended

## 📱 Mobile Considerations

The current UI is responsive, but for a finance app you might want to:

1. Add a mobile-first dashboard view
2. Implement touch-friendly transaction entry
3. Add quick action buttons (add expense, add income)
4. Consider a React Native companion app

## 🎯 Monetization Strategy

The Stripe integration is ready. Consider these tiers:

**Free Tier:**
- Up to 3 accounts
- Basic transaction tracking
- Simple budgets
- 6 months of history

**Premium Tier ($9.99/month):**
- Unlimited accounts
- Advanced analytics
- Goal tracking
- Unlimited history
- Bill reminders
- Export to CSV/PDF
- Priority support

## 📚 Resources

- **Original Template**: `/Users/eliedib/cursor/fundamental`
- **Template Docs**: See `README.md` and `PROJECT_SUMMARY.md`
- **Next.js Docs**: https://nextjs.org/docs
- **MongoDB Docs**: https://docs.mongodb.com
- **Stripe Docs**: https://stripe.com/docs

## 🚀 Deployment

When ready to deploy:

1. Set up production MongoDB (MongoDB Atlas)
2. Configure production Stripe keys
3. Set up production email service
4. Deploy to Vercel, Netlify, or your preferred platform

```bash
npm run build  # Test production build
vercel         # Deploy to Vercel
```

## 💬 Support

For questions about the template foundation, refer to the Fundamental documentation.

For SmartWealth-specific features, you're building those now!

---

**Start building your personal finance app today!** 🚀💰

The authentication, payments, and UI foundation are ready. Focus on building the core finance features that make SmartWealth unique.
