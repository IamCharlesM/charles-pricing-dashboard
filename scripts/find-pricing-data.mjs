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

async function findPricingData() {
  console.log("Searching for rows with pricing data...\n")

  // Find rows where raw_data contains offerPrice that is not null
  const withPricing = await sql`
    SELECT
      id,
      source_url,
      raw_data->>'mpn' as mpn,
      raw_data->>'brand' as brand,
      raw_data->>'title' as title,
      raw_data->>'offerPrice' as offer_price,
      raw_data->>'regularPrice' as regular_price
    FROM raw_llm_extraction
    WHERE raw_data->>'offerPrice' IS NOT NULL
      AND raw_data->>'offerPrice' != 'null'
    LIMIT 20
  `

  console.log(`Found ${withPricing.length} rows with pricing data (showing up to 20):\n`)
  console.table(withPricing)

  // Count total with pricing
  const count = await sql`
    SELECT COUNT(*) as count
    FROM raw_llm_extraction
    WHERE raw_data->>'offerPrice' IS NOT NULL
      AND raw_data->>'offerPrice' != 'null'
  `

  console.log(`\nTotal rows with pricing: ${count[0].count}`)
}

findPricingData().catch(console.error)
