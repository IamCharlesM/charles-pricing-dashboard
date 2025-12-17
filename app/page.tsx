"use client"

import { useEffect, useState, useCallback } from "react"
import { ProductWithPricing } from "@/lib/db"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, DollarSign, TrendingDown, ExternalLink, ArrowUpDown, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface GroupedProduct {
  sku: string
  title: string
  brand: string
  category: string
  variants: ProductWithPricing[]
  lowestPrice: number
  highestPrice: number
  priceRange: string
}

// Skeleton loading component for table rows
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <Skeleton className="h-[60px] w-[60px] rounded-md" />
      </TableCell>
      <TableCell className="whitespace-normal">
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell className="min-w-[300px] whitespace-normal">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell className="whitespace-normal">
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell className="whitespace-normal">
        <Skeleton className="h-6 w-16 rounded-full" />
      </TableCell>
      <TableCell className="whitespace-normal">
        <Skeleton className="h-4 w-32" />
      </TableCell>
    </TableRow>
  )
}

export default function Home() {
  const [products, setProducts] = useState<ProductWithPricing[]>([])
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([])
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  // Note: SKU sorting removed from MVP - needs data optimization for proper numeric/alpha sorting
  // TODO: Implement smart SKU sorting: numbers first (numeric order), then letters (alpha order), then blanks
  const [sortField, setSortField] = useState<'title' | 'brand'>('title')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  const { toast } = useToast()

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1 on new search
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: sortField,
        sortOrder: sortDirection,
        search: debouncedSearch,
      })

      const res = await fetch(`/api/products?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch products")
      const data = await res.json()

      const fetchedProducts = data.products || []
      setProducts(fetchedProducts)
      setPagination(data.pagination)

      // Group products by SKU, and group unknown SKUs by exact title match
      const grouped = new Map<string, ProductWithPricing[]>()
      const unknownProducts: ProductWithPricing[] = []

      fetchedProducts.forEach((product: ProductWithPricing) => {
        const sku = product.sku || 'unknown'

        // Collect unknown SKU products separately to group by title
        if (sku === 'unknown') {
          unknownProducts.push(product)
        } else {
          if (!grouped.has(sku)) {
            grouped.set(sku, [])
          }
          grouped.get(sku)!.push(product)
        }
      })

      // Convert to GroupedProduct array (known SKUs)
      const groupedArray: GroupedProduct[] = Array.from(grouped.entries()).map(([sku, variants]) => {
        const prices = variants.map(v => v.offerPrice)
        const lowestPrice = Math.min(...prices)
        const highestPrice = Math.max(...prices)
        const priceRange = lowestPrice === highestPrice
          ? formatPrice(lowestPrice)
          : `${formatPrice(lowestPrice)} - ${formatPrice(highestPrice)}`

        return {
          sku,
          title: variants[0].title,
          brand: variants[0].brand,
          category: variants[0].category,
          variants,
          lowestPrice,
          highestPrice,
          priceRange
        }
      })

      // Group unknown SKU products by exact title match
      const unknownByTitle = new Map<string, ProductWithPricing[]>()
      unknownProducts.forEach(product => {
        const title = product.title || 'Untitled Product'
        if (!unknownByTitle.has(title)) {
          unknownByTitle.set(title, [])
        }
        unknownByTitle.get(title)!.push(product)
      })

      // Convert unknown products to GroupedProduct array
      let unknownIdCounter = 0
      const unknownGroups: GroupedProduct[] = Array.from(unknownByTitle.entries()).map(([title, variants]) => {
        const prices = variants.map(v => v.offerPrice)
        const lowestPrice = Math.min(...prices)
        const highestPrice = Math.max(...prices)
        const priceRange = lowestPrice === highestPrice
          ? formatPrice(lowestPrice)
          : `${formatPrice(lowestPrice)} - ${formatPrice(highestPrice)}`

        unknownIdCounter++
        return {
          sku: `unknown-${unknownIdCounter}`, // Unique identifier for unknown group
          title,
          brand: variants[0].brand,
          category: variants[0].category,
          variants,
          lowestPrice,
          highestPrice,
          priceRange
        }
      })

      // Combine: known SKUs first, then unknown (grouped by title) at the bottom
      const finalGroupedArray = [...groupedArray, ...unknownGroups]

      setGroupedProducts(finalGroupedArray)
      setLoading(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch products. Please try again.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, sortField, sortDirection, debouncedSearch, toast])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1 on sort change
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price)
  }

  const toggleSkuExpansion = (sku: string) => {
    setExpandedSkus(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sku)) {
        newSet.delete(sku)
      } else {
        newSet.add(sku)
      }
      return newSet
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <DollarSign className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Product Pricing Dashboard</h1>
              <p className="text-lg text-muted-foreground" aria-live="polite" aria-atomic="true">
                Displaying {groupedProducts.length} unique SKUs ({products.length} total products)
              </p>
            </div>
          </div>
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Products</CardTitle>
            <CardDescription>Search by SKU, product name, or brand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <label htmlFor="product-search" className="sr-only">
                Search products by SKU, product name, or brand
              </label>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="product-search"
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search products by SKU, product name, or brand"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <div className="overflow-x-auto">
              <Table role="table" aria-label="Loading product pricing information">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">
                      <span className="sr-only">Product Image</span>
                      <span aria-hidden="true">Image</span>
                    </TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">SKU</TableHead>
                    <TableHead scope="col" className="min-w-[300px] whitespace-normal font-semibold text-muted-foreground">
                      Product Name
                    </TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Price</TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Original Price</TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Discount</TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : groupedProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center" role="status" aria-live="polite">
              <p className="text-lg text-muted-foreground mb-2">No products found</p>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch ? "Try a different search term" : "No products with SKU available"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
          <Card>
            <div className="overflow-x-auto">
              <Table role="table" aria-label="Product pricing information">
                <TableCaption className="sr-only">
                  Product pricing table with columns for image, SKU, product name, price, original price, discount, and source. Products are grouped by SKU.
                  {groupedProducts.length > 0 && `Showing ${groupedProducts.length} unique SKUs from ${products.length} total products on page ${pagination.page} of ${pagination.totalPages}.`}
                </TableCaption>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">
                      <span className="sr-only">Product Image</span>
                      <span aria-hidden="true">Image</span>
                    </TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">
                      SKU
                    </TableHead>
                    <TableHead scope="col" className="min-w-[300px] whitespace-normal font-semibold text-muted-foreground">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('title')}
                        className="hover:bg-muted font-semibold text-muted-foreground h-auto p-0"
                        aria-label={`Sort by Product Name ${sortField === 'title' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : ''}`}
                        aria-sort={sortField === 'title' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        Product Name
                        <span className="ml-2 inline-flex w-4 shrink-0 items-center justify-center">
                          {sortField === 'title' ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Price</TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Original Price</TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Discount</TableHead>
                    <TableHead scope="col" className="whitespace-normal font-semibold text-muted-foreground">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedProducts.map((group) => {
                    const isExpanded = expandedSkus.has(group.sku)
                    const hasMultipleVariants = group.variants.length > 1

                    return (
                      <>
                        {/* Main row for the SKU group */}
                        <TableRow
                          key={group.sku}
                          className={hasMultipleVariants ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => hasMultipleVariants && toggleSkuExpansion(group.sku)}
                        >
                          <TableCell className="whitespace-normal">
                            <img
                              src={`https://placehold.co/60x60/e2e8f0/64748b?text=${encodeURIComponent(group.brand || 'Product')}`}
                              alt={`${group.brand ? group.brand + ' ' : ''}${group.title || 'Product'} image`}
                              className="w-[60px] h-[60px] object-cover rounded-md"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium whitespace-normal">
                            <div className="break-words">
                              {group.sku.startsWith('unknown-') ? <span aria-label="Not available">—</span> : group.sku}
                              {hasMultipleVariants && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {group.variants.length} sources
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[300px] whitespace-normal">
                            <div className="w-full">
                              <div className="font-medium break-words">
                                {group.title || 'Untitled Product'}
                              </div>
                              {group.brand && (
                                <div className="text-sm text-muted-foreground mt-1 break-words">
                                  {group.brand}
                                </div>
                              )}
                              {group.category && (
                                <div className="text-xs text-muted-foreground mt-1 break-words">
                                  {group.category}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold whitespace-normal break-words">
                            <span aria-label={`Price range: ${group.priceRange}`}>
                              {group.priceRange}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-normal break-words">
                            {group.variants[0].regularPrice ? (
                              <span className="line-through" aria-label={`Original price: ${formatPrice(group.variants[0].regularPrice)}`}>
                                {formatPrice(group.variants[0].regularPrice)}
                              </span>
                            ) : (
                              <span aria-label="Not available">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal break-words">
                            {group.variants[0].discount ? (
                              <Badge variant="secondary" className="gap-1" aria-label={`Discount: ${group.variants[0].discount} percent`}>
                                <TrendingDown className="h-3 w-3" aria-hidden="true" />
                                {group.variants[0].discount}%
                              </Badge>
                            ) : (
                              <span aria-label="No discount">—</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal break-words">
                            {hasMultipleVariants ? (
                              <Button variant="ghost" size="sm" className="h-auto p-0">
                                {isExpanded ? 'Hide' : 'Compare'} prices
                              </Button>
                            ) : group.variants[0].source_url ? (
                              <a
                                href={group.variants[0].source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline text-sm break-words"
                                aria-label={`View product on ${group.variants[0].domain} (opens in new window)`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="break-words">{group.variants[0].domain}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground break-words">{group.variants[0].domain}</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded variant rows */}
                        {isExpanded && hasMultipleVariants && group.variants.map((variant, idx) => (
                          <TableRow key={`${group.sku}-${variant.id}`} className="bg-muted/20">
                            <TableCell className="pl-8" colSpan={3}>
                              <div className="text-sm text-muted-foreground">
                                Variant {idx + 1}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold whitespace-normal break-words">
                              <span aria-label={`Price: ${formatPrice(variant.offerPrice)}`}>
                                {formatPrice(variant.offerPrice)}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground whitespace-normal break-words">
                              {variant.regularPrice ? (
                                <span className="line-through" aria-label={`Original price: ${formatPrice(variant.regularPrice)}`}>
                                  {formatPrice(variant.regularPrice)}
                                </span>
                              ) : (
                                <span aria-label="Not available">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-normal break-words">
                              {variant.discount ? (
                                <Badge variant="secondary" className="gap-1" aria-label={`Discount: ${variant.discount} percent`}>
                                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                                  {variant.discount}%
                                </Badge>
                              ) : (
                                <span aria-label="No discount">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-normal break-words">
                              {variant.source_url ? (
                                <a
                                  href={variant.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline text-sm break-words"
                                  aria-label={`View product on ${variant.domain} (opens in new window)`}
                                >
                                  <span className="break-words">{variant.domain}</span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                                </a>
                              ) : (
                                <span className="text-sm text-muted-foreground break-words">{variant.domain}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination Controls */}
          <Card className="mt-4">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total products)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1 || loading}
                    aria-label="Go to previous page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      // Show pages around current page
                      let pageNum
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i
                      } else {
                        pageNum = pagination.page - 2 + i
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={pagination.page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                          className="w-10"
                          aria-label={`Go to page ${pageNum}`}
                          aria-current={pagination.page === pageNum ? "page" : undefined}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages || loading}
                    aria-label="Go to next page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          </>
        )}
      </div>
    </div>
  )
}
