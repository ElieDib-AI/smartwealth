import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDb } from '@/lib/database'
import { createPortalSession } from '@/lib/stripe'
import { ObjectId } from 'mongodb'

/**
 * POST /api/stripe/portal
 * Create a Stripe customer portal session
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

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'No subscription found' },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = `${baseUrl}/profile`

    const session = await createPortalSession(user.stripeCustomerId, returnUrl)

    return NextResponse.json({
      success: true,
      data: {
        url: session.url
      }
    })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
