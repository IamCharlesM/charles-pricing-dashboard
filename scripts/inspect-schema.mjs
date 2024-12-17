import { neon } from "@neondatabase/serverless"
import { readFileSync } from "fs"

// Load DATABASE_URL from .env.local
const envFile = readFileSync('.env.local', 'utf-8')
const dbUrl = envFile.match(/DATABASE_URL=(.+)/)?.[1]

if (!dbUrl) {
  console.error("DATABASE_URL not found in .env.local")
  process.exit(1)
}

const sql = neon(dbUrl)

async function inspectSchema() {
  console.log("Inspecting database schema...\n")

  // Get table columns
  const columns = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'products'
    ORDER BY ordinal_position;
  `

  console.log("Products table columns:")
  console.table(columns)

  // Count total rows
  const count = await sql`
    SELECT COUNT(*) as count FROM products;
  `

  console.log(`\nTotal products: ${count[0].count}`)

  // Get a sample row
  const sample = await sql`
    SELECT * FROM products LIMIT 3;
  `

  if (sample.length > 0) {
    console.log("\nSample products:")
    sample.forEach((product, index) => {
      console.log(`\n--- Product ${index + 1} ---`)
      console.log(`ID: ${product.id}`)
      console.log(`Title: ${product.title}`)
      console.log(`Brand: ${product.brand}`)
      console.log(`MPN: ${product.mpn}`)
      console.log(`Offer Price: ${product.offer_price}`)
      console.log(`Regular Price: ${product.regular_price}`)
      console.log(`Source URL: ${product.source_url}`)
      console.log(`Category: ${product.category}`)
    })
  } else {
    console.log("\n⚠️  Database is empty - no products found")
    console.log("\nThe database table exists but contains no data.")
    console.log("Products need to be scraped and inserted before they'll appear in the dashboard.")
  }

  // Check products with valid pricing
  const validPricing = await sql`
    SELECT COUNT(*) as count FROM products
    WHERE offer_price IS NOT NULL AND offer_price > 0;
  `

  console.log(`\n✓ Products with valid offer_price: ${validPricing[0].count}`)
}

inspectSchema().catch(console.error)
