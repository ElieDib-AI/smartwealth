import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
import { generateVerificationToken, hashToken } from '@/lib/auth'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const db = await getDb()

    // Find user
    const user = await db.collection('users').findOne({ email: email.toLowerCase() })

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.'
      })
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { success: false, error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Delete any existing tokens for this user
    await db.collection('emailVerificationTokens').deleteMany({ userId: user._id })

    // Generate new verification token
    const token = generateVerificationToken()
    const hashedTokenForDb = hashToken(token)

    // Store verification token
    await db.collection('emailVerificationTokens').insertOne({
      userId: user._id,
      token: hashedTokenForDb,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
    })

    // Send verification email
    const emailResult = await sendVerificationEmail(email, token, user.name)

    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error)
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}
