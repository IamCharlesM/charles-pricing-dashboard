import { NextRequest, NextResponse } from "next/server"
import { getProducts, ProductQueryOptions } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse query parameters for pagination, sorting, and search
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const sortBy = (searchParams.get('sortBy') || 'sku') as ProductQueryOptions['sortBy']
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc'
    const search = searchParams.get('search') || ''

    // Use database with pagination, sorting, and search
    const result = await getProducts({
      page,
      limit,
      sortBy,
      sortOrder,
      search
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
