import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDb } from '@/lib/database'
import { createCheckoutSession } from '@/lib/stripe'
import { ObjectId } from 'mongodb'

/**
 * POST /api/stripe/checkout
 * Create a Stripe checkout session for premium subscription
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = await getDb()
    const user = await db.collection('users').findOne({
      _id: new ObjectId(authUser.id)
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user already has an active subscription
    if (user.subscriptionTier === 'premium' && user.subscriptionStatus === 'active') {
      return NextResponse.json(
        { success: false, error: 'You already have an active subscription' },
        { status: 400 }
      )
    }

    // Get the base URL for redirect URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/dashboard?subscription=success`
    const cancelUrl = `${baseUrl}/pricing?subscription=canceled`

    // Create Stripe checkout session
    const session = await createCheckoutSession(
      authUser.id,
      user.email,
      successUrl,
      cancelUrl
    )

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      }
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
