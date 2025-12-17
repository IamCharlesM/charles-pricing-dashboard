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

async function listTables() {
  console.log("Listing all tables in the database...\n")

  // Get all tables from all schemas (excluding system schemas)
  const tables = await sql`
    SELECT
      table_schema,
      table_name,
      table_type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      AND table_schema NOT LIKE 'pg_temp_%'
      AND table_schema NOT LIKE 'pg_toast_temp_%'
    ORDER BY table_schema, table_name;
  `

  console.log("Tables found:")
  console.table(tables)

  // Group by schema
  const tablesBySchema = {}
  for (const table of tables) {
    if (!tablesBySchema[table.table_schema]) {
      tablesBySchema[table.table_schema] = []
    }
    tablesBySchema[table.table_schema].push(table)
  }

  console.log("\nTables by schema:")
  for (const [schema, schemaTables] of Object.entries(tablesBySchema)) {
    console.log(`\n${schema}:`)
    for (const table of schemaTables) {
      console.log(`  - ${table.table_name} (${table.table_type})`)
    }
  }

  // For each table, show row count
  console.log("\nRow counts:")
  for (const table of tables) {
    if (table.table_type === 'BASE TABLE') {
      try {
        // Use identifier quoting for schema and table names
        // Since table names come from information_schema (trusted), string interpolation is safe
        const quotedSchema = `"${table.table_schema.replace(/"/g, '""')}"`
        const quotedTable = `"${table.table_name.replace(/"/g, '""')}"`
        // Use template literal with string interpolation for dynamic table names
        const count = await sql(`SELECT COUNT(*) as count FROM ${quotedSchema}.${quotedTable}`)
        console.log(`  ${table.table_schema}.${table.table_name}: ${count[0].count} rows`)
      } catch (error) {
        console.log(`  ${table.table_schema}.${table.table_name}: Error counting rows - ${error.message}`)
      }
    }
  }
}

listTables().catch(console.error)
