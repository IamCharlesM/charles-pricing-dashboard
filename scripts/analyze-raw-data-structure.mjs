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

async function analyzeRawDataStructure() {
  console.log("Analyzing raw_data JSON structure...\n")

  // Get sample rows with pricing
  const sampleRows = await sql`
    SELECT raw_data
    FROM raw_llm_extraction
    WHERE raw_data->>'offerPrice' IS NOT NULL
      AND raw_data->>'offerPrice' != 'null'
    LIMIT 100
  `

  // Collect all unique keys
  const allKeys = new Set()
  const keyTypes = {}
  const keyExamples = {}

  sampleRows.forEach(row => {
    const data = row.raw_data
    Object.keys(data).forEach(key => {
      allKeys.add(key)

      // Track type
      const value = data[key]
      const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

      if (!keyTypes[key]) {
        keyTypes[key] = new Set()
      }
      keyTypes[key].add(type)

      // Store example
      if (!keyExamples[key] && value !== null) {
        keyExamples[key] = value
      }
    })
  })

  console.log("Found", allKeys.size, "unique keys in raw_data:\n")

  // Sort keys alphabetically
  const sortedKeys = Array.from(allKeys).sort()

  console.log("Keys with their types and examples:")
  console.log("=" .repeat(80))

  sortedKeys.forEach(key => {
    const types = Array.from(keyTypes[key]).join(' | ')
    const example = keyExamples[key]
    let exampleStr = ''

    if (example !== undefined) {
      if (typeof example === 'object') {
        exampleStr = JSON.stringify(example).substring(0, 100)
        if (JSON.stringify(example).length > 100) exampleStr += '...'
      } else {
        exampleStr = String(example)
      }
    }

    console.log(`\n${key}:`)
    console.log(`  Type: ${types}`)
    console.log(`  Example: ${exampleStr}`)
  })

  // Count how often each key appears
  console.log("\n" + "=".repeat(80))
  console.log("\nKey frequency (out of 100 samples):")
  console.log("=" .repeat(80))

  const keyFrequency = {}
  sampleRows.forEach(row => {
    Object.keys(row.raw_data).forEach(key => {
      keyFrequency[key] = (keyFrequency[key] || 0) + 1
    })
  })

  Object.entries(keyFrequency)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => {
      const percentage = ((count / sampleRows.length) * 100).toFixed(1)
      console.log(`  ${key.padEnd(20)} ${count}/100 (${percentage}%)`)
    })
}

analyzeRawDataStructure().catch(console.error)
