import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { connectToDatabase } from '@/lib/database'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/constants/categories'
import { CustomCategory } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { db } = await connectToDatabase()
    const customCategoriesCollection = db.collection('custom_categories')

    // Get user's custom categories
    const customCategories = await customCategoriesCollection
      .find({ userId: new ObjectId(user.id) })
      .toArray()

    return NextResponse.json({
      success: true,
      data: {
        predefined: {
          expense: EXPENSE_CATEGORIES,
          income: INCOME_CATEGORIES
        },
        custom: customCategories
      }
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch categories' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.type) {
      return NextResponse.json(
        { success: false, error: 'Name and type are required' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['expense', 'income'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be either "expense" or "income"' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const customCategoriesCollection = db.collection('custom_categories')

    // Check if category name already exists for this user
    const existingCategory = await customCategoriesCollection.findOne({
      userId: new ObjectId(user.id),
      name: body.name,
      type: body.type
    })

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: 'A category with this name already exists' },
        { status: 400 }
      )
    }

    // Create custom category
    const customCategory: Omit<CustomCategory, '_id'> = {
      userId: new ObjectId(user.id),
      name: body.name,
      type: body.type,
      icon: body.icon,
      color: body.color,
      subcategories: body.subcategories || [],
      createdAt: new Date()
    }

    const result = await customCategoriesCollection.insertOne(customCategory)

    return NextResponse.json({
      success: true,
      data: {
        ...customCategory,
        _id: result.insertedId
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating custom category:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create custom category' 
      },
      { status: 500 }
    )
  }
}
