import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getAuthUser } from '@/lib/auth'
import { connectToDatabase } from '@/lib/database'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate type if provided
    if (body.type && !['expense', 'income'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be either "expense" or "income"' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const customCategoriesCollection = db.collection('custom_categories')

    // Check if category exists and belongs to user
    const existingCategory = await customCategoriesCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(user.id)
    })

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Category not found or unauthorized' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with existing category
    if (body.name) {
      const nameConflict = await customCategoriesCollection.findOne({
        userId: new ObjectId(user.id),
        name: body.name,
        type: body.type || existingCategory.type,
        _id: { $ne: new ObjectId(id) }
      })

      if (nameConflict) {
        return NextResponse.json(
          { success: false, error: 'A category with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Update category
    const updateDoc: Record<string, unknown> = {}
    if (body.name !== undefined) updateDoc.name = body.name
    if (body.type !== undefined) updateDoc.type = body.type
    if (body.icon !== undefined) updateDoc.icon = body.icon
    if (body.color !== undefined) updateDoc.color = body.color
    if (body.subcategories !== undefined) updateDoc.subcategories = body.subcategories

    const result = await customCategoriesCollection.findOneAndUpdate(
      { _id: new ObjectId(id), userId: new ObjectId(user.id) },
      { $set: updateDoc },
      { returnDocument: 'after' }
    )

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Failed to update category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update category' 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const customCategoriesCollection = db.collection('custom_categories')
    const transactionsCollection = db.collection('transactions')

    // Check if category exists and belongs to user
    const category = await customCategoriesCollection.findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(user.id)
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found or unauthorized' },
        { status: 404 }
      )
    }

    // Check if category is being used by any transactions
    const transactionCount = await transactionsCollection.countDocuments({
      userId: new ObjectId(user.id),
      category: category.name
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete category. It is used by ${transactionCount} transaction(s)` 
        },
        { status: 400 }
      )
    }

    // Delete category
    await customCategoriesCollection.deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(user.id)
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Category deleted successfully' }
    })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete category' 
      },
      { status: 500 }
    )
  }
}
