import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/database'
import { hashToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
    }

    const hashedToken = hashToken(token)
    const db = await getDb()

    // Find verification token
    const verificationToken = await db.collection('emailVerificationTokens').findOne({
      token: hashedToken
    })

    if (!verificationToken) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
    }

    // Check if token is expired
    if (verificationToken.expiresAt < new Date()) {
      return NextResponse.redirect(new URL('/login?error=expired_token', request.url))
    }

    // Update user email verified status
    const result = await db.collection('users').updateOne(
      { _id: verificationToken.userId },
      { 
        $set: { 
          emailVerified: true,
          updatedAt: new Date()
        }
      }
    )

    if (result.modifiedCount === 0) {
      return NextResponse.redirect(new URL('/login?error=verification_failed', request.url))
    }

    // Delete the used token
    await db.collection('emailVerificationTokens').deleteOne({ _id: verificationToken._id })

    // Redirect to login with success message
    return NextResponse.redirect(new URL('/login?verified=true', request.url))
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.redirect(new URL('/login?error=verification_failed', request.url))
  }
}
