import { pgTable, bigint, varchar, text, numeric, jsonb, timestamp, integer } from 'drizzle-orm/pg-core'

// Raw LLM extraction table - contains product data extracted by LLM from web scrapes
export const rawLlmExtraction = pgTable('raw_llm_extraction', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  created_at: timestamp('created_at', { withTimezone: true }),
  updated_at: timestamp('updated_at', { withTimezone: true }),
  llm_model: varchar('llm_model').notNull(),
  llm_provider: varchar('llm_provider'),
  source_url: text('source_url').notNull(),
  source_hash: varchar('source_hash'),
  raw_data: jsonb('raw_data').notNull(), // Contains: sku, text, brand, title, specs, images, category, offerPrice, regularPrice
  actor_id: varchar('actor_id'),
  flowrun_id: varchar('flowrun_id'),
  processing_time_ms: integer('processing_time_ms'),
  tokens_used: integer('tokens_used'),
  model_temperature: numeric('model_temperature'),
  status: varchar('status'),
  validation_id: bigint('validation_id', { mode: 'number' }),
  synthesized_product_id: bigint('synthesized_product_id', { mode: 'number' }),
})

export type RawLlmExtraction = typeof rawLlmExtraction.$inferSelect
export type NewRawLlmExtraction = typeof rawLlmExtraction.$inferInsert
