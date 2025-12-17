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

async function inspectRawLLM() {
  console.log("Inspecting raw_llm_extraction table...\n")

  // Get table structure
  const columns = await sql`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'raw_llm_extraction'
    ORDER BY ordinal_position;
  `

  console.log("Table Structure:")
  console.table(columns)

  // Get row count
  const count = await sql`SELECT COUNT(*) as count FROM raw_llm_extraction`
  console.log(`\nTotal rows: ${count[0].count}`)

  // Get sample rows
  const sampleRows = await sql`
    SELECT *
    FROM raw_llm_extraction
    LIMIT 5
  `

  console.log("\nSample rows:")
  console.log(JSON.stringify(sampleRows, null, 2))
}

inspectRawLLM().catch(console.error)
