import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { getDb } from '@/lib/database'
import { ObjectId } from 'mongodb'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export interface AuthUser {
  id: string
  _id: ObjectId
  email: string
  name: string
  emailVerified?: boolean
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthUser(request?: NextRequest): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')

    if (!token) {
      return null
    }

    const decoded = jwt.verify(token.value, JWT_SECRET) as { userId: string }

    const db = await getDb()
    const user = await db.collection('users').findOne({
      _id: new ObjectId(decoded.userId)
    })

    if (!user) {
      return null
    }

    return {
      id: user._id.toString(),
      _id: user._id,
      email: user.email,
      name: user.name || user.email,
      emailVerified: user.emailVerified || false
    }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

/**
 * Generate verification token
 */
export function generateVerificationToken(): string {
  const crypto = require('crypto')
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Hash token for secure storage
 */
export function hashToken(token: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(token).digest('hex')
}
