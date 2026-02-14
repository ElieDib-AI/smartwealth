import Stripe from 'stripe'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
})

// Stripe product and price IDs (set these after creating products in Stripe)
export const STRIPE_PRODUCTS = {
  PREMIUM_YEARLY: {
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
    amount: 10000, // $100.00 in cents
    currency: 'usd',
    interval: 'year',
  },
}

/**
 * Create a Stripe checkout session for premium subscription
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer_email: userEmail,
    client_reference_id: userId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price: STRIPE_PRODUCTS.PREMIUM_YEARLY.priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 14, // 14-day free trial
      metadata: {
        userId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
  })

  return session
}

/**
 * Create a Stripe customer portal session for managing subscription
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.cancel(subscriptionId)
  return subscription
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  return subscription
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(subscription: Stripe.Subscription): boolean {
  return ['active', 'trialing'].includes(subscription.status)
}
