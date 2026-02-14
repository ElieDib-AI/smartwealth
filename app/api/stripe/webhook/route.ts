import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getDb } from '@/lib/database'
import { ObjectId } from 'mongodb'
import Stripe from 'stripe'

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const db = await getDb()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (!userId) {
          console.error('No userId in session metadata')
          break
        }

        // Update user with subscription info
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              subscriptionTier: 'premium',
              subscriptionStatus: 'active',
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              updatedAt: new Date(),
            }
          }
        )

        // Create subscription record using session data
        await db.collection('subscriptions').insertOne({
          userId: new ObjectId(userId),
          tier: 'premium' as const,
          status: 'active' as const,
          provider: 'stripe' as const,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        console.log(`Subscription activated for user ${userId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by customer ID
        const user = await db.collection('users').findOne({ stripeCustomerId: customerId })
        if (!user) {
          console.error('User not found for customer:', customerId)
          break
        }

        // Update subscription status
        const status = subscription.status === 'active' || subscription.status === 'trialing' 
          ? 'active' 
          : subscription.status === 'canceled' 
          ? 'canceled' 
          : 'expired'

        await db.collection('users').updateOne(
          { _id: user._id },
          {
            $set: {
              subscriptionStatus: status,
              updatedAt: new Date(),
            }
          }
        )

        await db.collection('subscriptions').updateOne(
          { stripeSubscriptionId: subscription.id },
          {
            $set: {
              status,
              updatedAt: new Date(),
            }
          }
        )

        console.log(`Subscription updated for user ${user._id}: ${status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find user by customer ID
        const user = await db.collection('users').findOne({ stripeCustomerId: customerId })
        if (!user) {
          console.error('User not found for customer:', customerId)
          break
        }

        // Downgrade to free tier
        await db.collection('users').updateOne(
          { _id: user._id },
          {
            $set: {
              subscriptionTier: 'free',
              subscriptionStatus: 'canceled',
              updatedAt: new Date(),
            }
          }
        )

        await db.collection('subscriptions').updateOne(
          { stripeSubscriptionId: subscription.id },
          {
            $set: {
              status: 'canceled',
              canceledAt: new Date(),
              updatedAt: new Date(),
            }
          }
        )

        console.log(`Subscription canceled for user ${user._id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find user by customer ID
        const user = await db.collection('users').findOne({ stripeCustomerId: customerId })
        if (!user) {
          console.error('User not found for customer:', customerId)
          break
        }

        // Mark subscription as expired
        await db.collection('users').updateOne(
          { _id: user._id },
          {
            $set: {
              subscriptionStatus: 'expired',
              updatedAt: new Date(),
            }
          }
        )

        console.log(`Payment failed for user ${user._id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
