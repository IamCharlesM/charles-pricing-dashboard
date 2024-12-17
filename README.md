# Product Pricing Dashboard

A Next.js application that displays scraped product pricing data from multiple e-commerce sources. Built as a technical assessment to demonstrate full-stack development capabilities with modern technologies.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Setup Instructions](#setup-instructions)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Building for Production](#building-for-production)
  - [Deploying to Vercel](#deploying-to-vercel)
- [Architecture](#architecture)
  - [Database Schema](#database-schema)
  - [Drizzle ORM Implementation](#drizzle-orm-implementation)
  - [Frontend Components](#frontend-components)
- [Assumptions Made](#assumptions-made)
- [What Would Be Improved With More Time](#what-would-be-improved-with-more-time)
  - [Performance Optimizations](#performance-optimizations)
  - [Features](#features-1)
  - [User Experience](#user-experience)
  - [Code Quality](#code-quality)
  - [DevOps](#devops)
  - [Data Quality](#data-quality)
- [Project Structure](#project-structure)

## Overview

This dashboard connects to a PostgreSQL database containing scraped product data and displays pricing information in a searchable, sortable table. Each product may have multiple scrapes from different sources, allowing users to compare prices across the internet.

## Tech Stack

- **Framework**: Next.js 16.0.10 (App Router)
- **Runtime**: React 19.2.0
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Drizzle ORM
- **Styling**: TailwindCSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **TypeScript**: Full type safety throughout
- **Package Manager**: npm

## Features

- **Product Listing**: Displays all products with valid USD pricing in a responsive table format
- **Server-Side Pagination**: Efficient pagination with configurable page size (default 50 items per page)
- **Product Grouping**: Groups products by SKU, showing price ranges when multiple sources exist
- **Search Functionality**: Real-time case-insensitive search by SKU, product name, brand, or description
- **Sortable Columns**: Click column headers to sort by Price, Discount percentage, Title, or Brand
- **Multiple Scrapes**: Shows all price points per product from different sources
- **Pricing Details**: Displays offer price, original price, and calculated discount percentage
- **Source Links**: External links to original product pages with domain display
- **Image Thumbnails**: Product images displayed in the table
- **Responsive Design**: Mobile-friendly table with horizontal scrolling
- **Loading States**: Skeleton loaders for better user experience during data fetching
- **Empty States**: User-friendly feedback when no products match search criteria

## Setup Instructions

### Prerequisites

- Node.js 18.x or higher
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dash
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the project root:
   ```bash
   DATABASE_URL=URL-HERE
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

### Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add DATABASE_URL production

# Deploy to production
vercel --prod
```

## Architecture

### Database Schema

The application uses a `raw_llm_extraction` table with the following structure:

```sql
CREATE TABLE raw_llm_extraction (
  id BIGINT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  llm_model VARCHAR NOT NULL,
  llm_provider VARCHAR,
  source_url TEXT NOT NULL,
  source_hash VARCHAR,
  raw_data JSONB NOT NULL,
  actor_id VARCHAR,
  flowrun_id VARCHAR,
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  model_temperature NUMERIC,
  status VARCHAR,
  validation_id BIGINT,
  synthesized_product_id BIGINT
);
```

**Key Points:**
- Each row represents one LLM extraction from a web scrape
- Multiple rows can share the same SKU (different sources = different prices)
- `raw_data` is a JSONB column containing the extracted product data
- Additional metadata tracks the LLM processing details

**JSONB Structure (raw_data):**
```typescript
{
  sku?: string | object     // SKU (string or {raw, display})
  mpn?: string              // Manufacturer Part Number
  text?: string | object    // Product description
  brand?: string | object   // Brand name
  title?: string | object   // Product title
  category?: string | object // Product category
  offerPrice: number        // Current price (required for display)
  regularPrice?: number     // Original/MSRP price
  currencyType?: string     // Currency type
  specs?: {
    sku?: string            // Alternative SKU location
    [key: string]: any      // Other specifications
  }
  images?: Array<{url: string}> // Product images
}
```

### Drizzle ORM Implementation

**Schema Definition** (`lib/schema.ts`):
- Defines the `raw_llm_extraction` table schema using Drizzle ORM
- Provides type inference for database queries

**Database Functions** (`lib/db.ts`):
- `getProducts(options)`: Fetches products with server-side pagination, sorting, and filtering
- Supports sorting by SKU, price, discount, title, and brand
- Implements full-text search across SKU, title, brand, and description
- Uses Drizzle ORM for type-safe database queries
- Returns `PaginatedProducts` with metadata (page, limit, total, totalPages)

**API Routes** (`app/api/products/route.ts`):
- `GET /api/products`: Returns paginated products (default: page 1, limit 50)
- Query parameters: `page`, `limit`, `sortBy`, `sortOrder`, `search`
- Example: `GET /api/products?page=2&limit=25&sortBy=offerPrice&sortOrder=desc&search=laptop`

### Frontend Components

**Main Page** (`app/page.tsx`):
- Client-side React component with state management
- Fetches data from API route
- Implements search and sort functionality
- Uses shadcn/ui components (Table, Card, Badge, Input, Button)

**UI Components** (`components/ui/`):
- Pre-built shadcn/ui components based on Radix UI
- Fully accessible, customizable, and type-safe

## Assumptions Made

1. **One Row = One Extraction**: Each database row represents a single LLM extraction from a web scrape. Multiple rows with the same SKU indicate different price points from different sources.

2. **USD Currency Only**: Products without a valid `offerPrice` in the `raw_data` JSONB are filtered out and not displayed.

3. **SKU Requirements**: Only products with a SKU (either in `specs.sku` or `mpn` field) are displayed.

4. **Search Scope**: Search functionality matches against:
   - SKU (from `raw_data.sku` or `specs.sku`)
   - Product title (from `raw_data.title`)
   - Product description (from `raw_data.text`)
   - Brand name (from `raw_data.brand`)

5. **Discount Calculation**: Discount percentage is calculated only when both `offerPrice` and `regularPrice` exist, and `regularPrice` is greater than `offerPrice`.

6. **Domain Extraction**: Source domain is extracted from the `source_url` field by parsing the URL hostname, with `www.` prefix removed for cleaner display.

7. **Product Name Fallback**: If `raw_data.title` is missing, falls back to `raw_data.text`, then displays "Untitled Product" as a last resort.

8. **Flexible Field Types**: Many fields in `raw_data` can be either strings or objects with `{raw, display}` structure. The application handles both formats gracefully.

## What Would Be Improved With More Time

### Performance Optimizations
- **Virtual Scrolling**: Use react-virtual or similar for better performance with very large tables
- **Caching Layer**: Implement Redis caching for frequently accessed data
- **Database Indexes**: Add indexes on JSONB fields for faster search queries
- **Query Optimization**: Use materialized views for complex aggregations

### Features
- **Advanced Filtering**:
  - Filter by category, brand, or price range
  - Multi-select filters with dynamic facets
  - Date range filtering for scrape timestamps
- **Price History Graphs**: Visual charts showing price changes over time per SKU
- **Export Functionality**: CSV/Excel export of filtered results
- **Product Details Modal**: Click a row to see full product details and all scrapes
- **Price Alerts**: Notify when prices drop below a threshold
- **Comparison View**: Side-by-side comparison of products

### User Experience
- **Better Mobile UX**: Optimize table for mobile with card-based responsive design
- **Column Customization**: Allow users to show/hide columns
- **Saved Searches**: Persist search/filter preferences
- **Dark Mode**: Full dark mode support (currently uses system preference)
- **Accessibility**: Comprehensive ARIA labels and keyboard navigation

### Code Quality
- **Unit Tests**: Jest/Vitest tests for utility functions and components
- **Integration Tests**: Playwright E2E tests for critical user flows
- **API Tests**: Test API routes with mock database
- **Error Boundaries**: React error boundaries for graceful error handling
- **Rate Limiting**: Implement rate limiting on API routes
- **Input Validation**: Add Zod schemas for runtime validation

### DevOps
- **CI/CD Pipeline**: Automated testing and deployment
- **Environment Management**: Separate dev/staging/production environments
- **Monitoring**: Application performance monitoring (APM) and error tracking
- **Database Migrations**: Automated migrations with Drizzle Kit
- **Docker**: Containerization for consistent environments

### Data Quality
- **Data Validation**: Stricter validation of scrape_data JSONB fields
- **Duplicate Detection**: Identify and merge duplicate scrapes
- **Data Normalization**: Standardize brand names, categories, etc.
- **Price Outlier Detection**: Flag suspicious price data
- **Smart SKU Sorting**: Implement intelligent SKU sorting (numbers first in numeric order, then letters in alphabetical order, then blanks/nulls at the end) - currently disabled due to inconsistent data format

## Project Structure

```
dash/
├── app/
│   ├── api/
│   │   └── products/
│   │       └── route.ts          # API endpoint
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout with metadata
│   ├── loading.tsx               # Loading component
│   └── page.tsx                  # Main dashboard page
├── components/
│   ├── ui/                       # shadcn/ui components
│   └── theme-provider.tsx        # Theme provider
├── hooks/
│   ├── use-mobile.ts             # Mobile detection hook
│   └── use-toast.ts              # Toast notification hook
├── lib/
│   ├── db.ts                     # Drizzle ORM functions
│   ├── schema.ts                 # Drizzle schema definition
│   └── utils.ts                  # Utility functions
├── public/                       # Static assets
│   ├── favicon.ico               # Site favicon
│   └── ...                       # Other images
├── scripts/                      # Utility scripts
├── drizzle.config.ts             # Drizzle configuration
├── postcss.config.mjs            # PostCSS configuration
├── .env.local                    # Environment variables (not in git)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── README.md                     # This file
```
