import { drizzle } from 'drizzle-orm/neon-serverless'
import { Pool } from '@neondatabase/serverless'
import { rawLlmExtraction } from './schema'
import { ilike, or, and, isNotNull, sql } from 'drizzle-orm'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const db = drizzle(pool)

// Helper type for fields that can be string or {raw, display} objects
type StringOrObject = string | { raw: string; display: string } | null

// Helper function to extract string from StringOrObject
function extractString(value: StringOrObject): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const obj = value as { raw?: string; display?: string }
    return obj.display || obj.raw || null
  }
  return null
}

// Raw data structure from JSONB column
export interface RawDataStructure {
  sku: StringOrObject
  text: StringOrObject
  brand: StringOrObject
  specs: Record<string, any> | null
  title: StringOrObject
  images: Array<{ url: string }>
  category: StringOrObject
  offerPrice: number
  regularPrice: number | null
  currencyType?: string
}

// Product from database with computed fields
export interface ProductWithPricing {
  id: number
  // Fields from raw_data JSONB
  title: string
  text: string | null
  brand: string
  sku: string | null
  category: string
  specs: Record<string, any> | null
  images: Array<{ url: string }>
  currencyType?: string
  // Fields from table columns
  source_url: string
  created_at: Date | null
  updated_at: Date | null
  // Computed fields
  offerPrice: number
  regularPrice?: number
  discount?: number
  domain: string
}

// Pagination and sorting options
// Note: SKU sorting removed from MVP - needs data optimization for proper numeric/alpha sorting
// TODO: Implement smart SKU sorting: numbers first (numeric order), then letters (alpha order), then blanks
export interface ProductQueryOptions {
  page?: number
  limit?: number
  sortBy?: 'sku' | 'offerPrice' | 'discount' | 'title' | 'brand' // 'sku' kept in interface but disabled in UI
  sortOrder?: 'asc' | 'desc'
  search?: string
}

// Response with pagination metadata
export interface PaginatedProducts {
  products: ProductWithPricing[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Get all products with valid USD pricing from raw_llm_extraction table
export async function getProducts(options: ProductQueryOptions = {}): Promise<PaginatedProducts> {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'sku',
      sortOrder = 'asc',
      search = ''
    } = options

    // Build base WHERE conditions
    const whereConditions = [
      sql`${rawLlmExtraction.raw_data}->>'offerPrice' IS NOT NULL`,
      sql`${rawLlmExtraction.raw_data}->>'offerPrice' != 'null'`,
      // Only include products with a SKU (either in specs.sku or mpn field)
      sql`(${rawLlmExtraction.raw_data}->'specs'->>'sku' IS NOT NULL OR ${rawLlmExtraction.raw_data}->>'mpn' IS NOT NULL)`
    ]

    // Add search conditions if search query provided
    if (search) {
      const lowerQuery = `%${search.toLowerCase()}%`
      whereConditions.push(
        or(
          sql`LOWER(${rawLlmExtraction.raw_data}->>'sku') LIKE ${lowerQuery}`,
          sql`LOWER(${rawLlmExtraction.raw_data}->>'title') LIKE ${lowerQuery}`,
          sql`LOWER(${rawLlmExtraction.raw_data}->>'brand') LIKE ${lowerQuery}`,
          sql`LOWER(${rawLlmExtraction.raw_data}->>'text') LIKE ${lowerQuery}`
        )!
      )
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(rawLlmExtraction)
      .where(and(...whereConditions))

    const total = Number(countResult[0]?.count || 0)
    const totalPages = Math.ceil(total / limit)

    // Build ORDER BY clause based on sortBy
    let orderByClause
    if (sortBy === 'offerPrice') {
      // Use CASE to safely handle non-numeric values - treat them as NULL and sort them last
      orderByClause = sql`
        CASE
          WHEN ${rawLlmExtraction.raw_data}->>'offerPrice' ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN CAST(${rawLlmExtraction.raw_data}->>'offerPrice' AS NUMERIC)
          ELSE NULL
        END ${sortOrder === 'desc' ? sql`DESC NULLS LAST` : sql`ASC NULLS LAST`}`
    } else if (sortBy === 'sku') {
      orderByClause = sql`${rawLlmExtraction.raw_data}->>'sku' ${sortOrder === 'desc' ? sql`DESC` : sql`ASC`}`
    } else if (sortBy === 'title') {
      orderByClause = sql`${rawLlmExtraction.raw_data}->>'title' ${sortOrder === 'desc' ? sql`DESC` : sql`ASC`}`
    } else if (sortBy === 'brand') {
      orderByClause = sql`${rawLlmExtraction.raw_data}->>'brand' ${sortOrder === 'desc' ? sql`DESC` : sql`ASC`}`
    } else {
      // For discount, we'll sort in application layer as it's computed
      orderByClause = sql`${rawLlmExtraction.raw_data}->>'offerPrice' ASC`
    }

    // Query raw_llm_extraction with pagination and sorting
    const allProducts = await db
      .select()
      .from(rawLlmExtraction)
      .where(and(...whereConditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset((page - 1) * limit)

    // Transform products from JSONB raw_data
    const products = allProducts
      .map((row: any) => {
        const rawData = row.raw_data as RawDataStructure

        // Validate offerPrice
        const offerPrice = typeof rawData.offerPrice === 'number'
          ? rawData.offerPrice
          : parseFloat(String(rawData.offerPrice))

        // Filter: must have valid USD pricing
        if (isNaN(offerPrice) || offerPrice <= 0) {
          return null
        }

        // Extract domain from source_url
        let domain = 'Unknown'
        if (row.source_url) {
          try {
            const url = new URL(row.source_url)
            domain = url.hostname.replace('www.', '')
          } catch (error) {
            // If URL parsing fails, try to extract domain manually
            const match = row.source_url.match(/https?:\/\/([^\/]+)/)
            if (match) {
              domain = match[1].replace('www.', '')
            }
          }
        }

        // Parse regularPrice and calculate discount
        let regularPrice: number | undefined
        let discount: number | undefined

        if (rawData.regularPrice !== null && rawData.regularPrice !== undefined) {
          regularPrice = typeof rawData.regularPrice === 'number'
            ? rawData.regularPrice
            : parseFloat(String(rawData.regularPrice))

          if (!isNaN(regularPrice) && regularPrice > offerPrice) {
            discount = Math.round(((regularPrice - offerPrice) / regularPrice) * 100)
          }
        }

        // Extract strings from StringOrObject fields
        const title = extractString(rawData.title)
        const text = extractString(rawData.text)
        const brand = extractString(rawData.brand)
        const category = extractString(rawData.category)

        // Extract SKU from specs.sku first, fallback to mpn field
        const sku = rawData.specs?.sku || extractString(rawData.sku)

        return {
          id: row.id,
          // Fields from raw_data JSONB
          title: title || text || 'Untitled Product',
          text,
          brand: brand || 'Unknown',
          sku,
          category: category || '',
          specs: rawData.specs,
          images: rawData.images || [],
          currencyType: rawData.currencyType,
          // Fields from table columns
          source_url: row.source_url,
          created_at: row.created_at,
          updated_at: row.updated_at,
          // Computed fields
          offerPrice,
          regularPrice,
          discount,
          domain,
        } as ProductWithPricing
      })
      .filter((p): p is ProductWithPricing => p !== null)

    // If sorting by discount, sort in application layer since it's computed
    if (sortBy === 'discount') {
      products.sort((a, b) => {
        const aDiscount = a.discount || 0
        const bDiscount = b.discount || 0
        return sortOrder === 'desc' ? bDiscount - aDiscount : aDiscount - bDiscount
      })
    }

    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }
  } catch (error) {
    console.error('Database error:', error)
    throw new Error('Failed to fetch products')
  }
}

