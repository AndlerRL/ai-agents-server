/**
 * Database Schema for RAG Systems with pgvector
 * Supports multiple retrieval strategies and adaptive granularity
 * Using snake_case for database columns, camelCase for TypeScript
 */

import { pgTable, uuid, text, timestamp, jsonb, integer, real, index, customType, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// Enums for Predictable Values
// ============================================================================

// Chunk granularity levels for adaptive retrieval
export const granularityEnum = pgEnum('granularity', ['fine', 'coarse'])

// Difficulty levels for content and queries
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard'])

// Retrieval strategies available in the system
export const strategyEnum = pgEnum('strategy', [
  'retrieve_read',
  'hybrid',
  'two_stage_rerank',
  'fusion_in_decoder',
  'augmented_reranking', 
  'federated',
  'graph_rag',
  'adaptive'
])

// Query types for analytical purposes
export const queryTypeEnum = pgEnum('query_type', [
  'factual',
  'analytical', 
  'creative',
  'comparison',
  'summarization',
  'reasoning'
])

// Knowledge graph entity types
export const entityTypeEnum = pgEnum('entity_type', [
  'concept',
  'person',
  'organization',
  'location',
  'event',
  'product',
  'technology',
  'methodology',
  'process'
])

// Embedding shard types for federated retrieval
export const shardTypeEnum = pgEnum('shard_type', [
  'domain',
  'temporal', 
  'source',
  'quality',
  'language',
  'geographic'
])

// Content types for documents and chunks
export const contentTypeEnum = pgEnum('content_type', [
  'text',
  'code',
  'markdown',
  'json',
  'xml',
  'html',
  'documentation',
  'article',
  'reference'
])

// Embedding models supported
export const embeddingModelEnum = pgEnum('embedding_model', [
  'text-embedding-ada-002',
  'text-embedding-3-small',
  'text-embedding-3-large',
  'all-MiniLM-L6-v2',
  'all-mpnet-base-v2',
  'multi-qa-MiniLM-L6-cos-v1'
])

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string; config?: { dimensions?: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number)
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
})

// ============================================================================
// Core Document Management
// ============================================================================

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull().unique(),
  source: text('source'), // URL, file path, etc.
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  
  // Embedding model tracking for traceability
  embeddingModel: embeddingModelEnum('embedding_model').notNull(),
  embeddingModelVersion: text('embedding_model_version').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  indexedAt: timestamp('indexed_at'),
}, (table) => ([
  index('documents_source_idx').on(table.source),
  index('documents_embedding_model_idx').on(table.embeddingModel),
  index('documents_content_hash_idx').on(table.contentHash),
]))

// ============================================================================
// Adaptive Retrieval Granularity - Dual Resolution Chunks
// ============================================================================

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  
  // Content and positioning
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
  
  // Adaptive granularity support
  granularity: granularityEnum('granularity').notNull(),
  chunkSize: integer('chunk_size').notNull(),
  
  // Vector embeddings
  embedding: vector('embedding', { dimensions: 1536 }), // Default to OpenAI ada-002 dimensions
  
  // Sparse retrieval support (BM25-style)
  keywordVector: jsonb('keyword_vector').$type<Record<string, number>>().default({}),
  
  // Metadata for chunk-level information
  metadata: jsonb('metadata').$type<{
    parentChunkId?: string
    childChunkIds?: string[]
    tokens?: number
    language?: string
    contentType?: 'text' | 'code' | 'markdown' | 'json' | 'xml' | 'html' | 'documentation' | 'article' | 'reference'
    difficulty?: 'easy' | 'medium' | 'hard'
    [key: string]: any
  }>().default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('chunks_document_idx').on(table.documentId),
  index('chunks_granularity_idx').on(table.granularity),
  index('chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  index('chunks_embedding_ivf_idx').using('ivfflat', table.embedding.op('vector_cosine_ops')),
]))

// ============================================================================
// Graph RAG Support
// ============================================================================

export const knowledgeGraph = pgTable('knowledge_graph', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Entity information
  entityId: text('entity_id').notNull().unique(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityName: text('entity_name').notNull(),
  
  // Vector representation of entity
  embedding: vector('embedding', { dimensions: 1536 }),
  
  // Graph metadata
  metadata: jsonb('metadata').$type<{
    aliases?: string[]
    description?: string
    confidence?: number
    extractedFrom?: string[]
    [key: string]: any
  }>().default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('kg_entity_idx').on(table.entityId),
  index('kg_type_idx').on(table.entityType),
  index('kg_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]))

export const graphRelations = pgTable('knowledge_graph_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  sourceEntityId: text('source_entity_id').references(() => knowledgeGraph.entityId, { onDelete: 'cascade' }).notNull(),
  targetEntityId: text('target_entity_id').references(() => knowledgeGraph.entityId, { onDelete: 'cascade' }).notNull(),
  
  relationshipType: text('relationship_type').notNull(),
  relationshipStrength: real('relationship_strength').default(1.0),
  
  // Support for relation embeddings
  relationEmbedding: vector('relation_embedding', { dimensions: 1536 }),
  
  metadata: jsonb('metadata').$type<{
    confidence?: number
    extractedFrom?: string[]
    bidirectional?: boolean
    [key: string]: any
  }>().default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('kg_relations_source_idx').on(table.sourceEntityId),
  index('kg_relations_target_idx').on(table.targetEntityId),
  index('kg_relations_type_idx').on(table.relationshipType),
]))

// ============================================================================
// Retrieval Analytics and Optimization
// ============================================================================

export const retrievalSessions = pgTable('retrieval_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  query: text('query').notNull(),
  queryHash: text('query_hash').notNull(),
  
  // Query characteristics for adaptive routing
  queryDifficulty: difficultyEnum('query_difficulty'),
  queryLength: integer('query_length').notNull(),
  queryType: queryTypeEnum('query_type'),
  
  // Retrieval strategy used
  strategy: strategyEnum('strategy').notNull(),
  topK: integer('top_k').notNull(),
  granularity: granularityEnum('granularity').notNull(),
  
  // Performance metrics
  latencyMs: integer('latency_ms'),
  embeddingGenTime: integer('embedding_gen_time_ms'),
  retrievalTime: integer('retrieval_time_ms'),
  rerankingTime: integer('reranking_time_ms'),
  
  // Quality metrics
  resultsReturned: integer('results_returned'),
  userFeedback: integer('user_feedback'), // 1-5 rating
  
  metadata: jsonb('metadata').$type<{
    modelUsed?: string
    clientId?: string
    sessionId?: string
    [key: string]: any
  }>().default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('retrieval_query_hash_idx').on(table.queryHash),
  index('retrieval_strategy_idx').on(table.strategy),
  index('retrieval_difficulty_idx').on(table.queryDifficulty),
  index('retrieval_created_at_idx').on(table.createdAt),
]))

export const retrievalResults = pgTable('retrieval_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => retrievalSessions.id, { onDelete: 'cascade' }).notNull(),
  
  chunkId: uuid('chunk_id').references(() => documentChunks.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').references(() => knowledgeGraph.entityId, { onDelete: 'cascade' }),
  
  // Scoring information
  denseScore: real('dense_score'),
  sparseScore: real('sparse_score'),
  hybridScore: real('hybrid_score'),
  rerankScore: real('rerank_score'),
  finalScore: real('final_score').notNull(),
  
  rank: integer('rank').notNull(),
  
  metadata: jsonb('metadata').$type<{
    retrievalMethod?: string
    explanation?: string
    [key: string]: any
  }>().default({}),
}, (table) => ([
  index('retrieval_results_session_idx').on(table.sessionId),
  index('retrieval_results_score_idx').on(table.finalScore),
  index('retrieval_results_rank_idx').on(table.rank),
]))

// ============================================================================
// Embedding Shards for Federated Retrieval
// ============================================================================

export const embeddingShards = pgTable('embedding_shards', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  shardName: text('shard_name').notNull().unique(),
  shardType: shardTypeEnum('shard_type').notNull(),
  
  // Shard characteristics
  documentCount: integer('document_count').default(0),
  averageQuality: real('average_quality').default(0.0),
  lastUpdated: timestamp('last_updated').defaultNow(),
  
  // Shard metadata for routing decisions
  metadata: jsonb('metadata').$type<{
    domains?: string[]
    dateRange?: { start: string, end: string }
    sources?: string[]
    languages?: string[]
    minQuality?: number
    maxQuality?: number
    [key: string]: any
  }>().default({}),
  
  // Performance characteristics
  avgRetrievalTime: integer('avg_retrieval_time_ms').default(0),
  indexSize: integer('index_size_mb').default(0),
  
  isActive: integer('is_active').default(1), // SQLite-style boolean
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('shards_name_idx').on(table.shardName),
  index('shards_type_idx').on(table.shardType),
  index('shards_active_idx').on(table.isActive),
]))

export const documentShardMappings = pgTable('document_shard_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  shardId: uuid('shard_id').references(() => embeddingShards.id, { onDelete: 'cascade' }).notNull(),
  
  mappingWeight: real('mapping_weight').default(1.0), // For weighted routing
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('shard_mappings_document_idx').on(table.documentId),
  index('shard_mappings_shard_idx').on(table.shardId),
  index('shard_mappings_composite_idx').on(table.documentId, table.shardId),
]))

// ============================================================================
// Relations
// ============================================================================

export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(documentChunks),
  shardMappings: many(documentShardMappings),
}))

export const documentChunksRelations = relations(documentChunks, ({ one, many }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
  retrievalResults: many(retrievalResults),
}))

export const knowledgeGraphRelations = relations(knowledgeGraph, ({ many }) => ({
  outgoingRelations: many(graphRelations, { relationName: 'sourceEntity' }),
  incomingRelations: many(graphRelations, { relationName: 'targetEntity' }),
  retrievalResults: many(retrievalResults),
}))

export const graphRelationsRelations = relations(graphRelations, ({ one }) => ({
  sourceEntity: one(knowledgeGraph, {
    fields: [graphRelations.sourceEntityId],
    references: [knowledgeGraph.entityId],
    relationName: 'sourceEntity',
  }),
  targetEntity: one(knowledgeGraph, {
    fields: [graphRelations.targetEntityId],
    references: [knowledgeGraph.entityId],
    relationName: 'targetEntity',
  }),
}))

export const retrievalSessionsRelations = relations(retrievalSessions, ({ many }) => ({
  results: many(retrievalResults),
}))

export const retrievalResultsRelations = relations(retrievalResults, ({ one }) => ({
  session: one(retrievalSessions, {
    fields: [retrievalResults.sessionId],
    references: [retrievalSessions.id],
  }),
  chunk: one(documentChunks, {
    fields: [retrievalResults.chunkId],
    references: [documentChunks.id],
  }),
  entity: one(knowledgeGraph, {
    fields: [retrievalResults.entityId],
    references: [knowledgeGraph.entityId],
  }),
}))

export const embeddingShardsRelations = relations(embeddingShards, ({ many }) => ({
  documentMappings: many(documentShardMappings),
}))

export const documentShardMappingsRelations = relations(documentShardMappings, ({ one }) => ({
  document: one(documents, {
    fields: [documentShardMappings.documentId],
    references: [documents.id],
  }),
  shard: one(embeddingShards, {
    fields: [documentShardMappings.shardId],
    references: [embeddingShards.id],
  }),
}))

// ============================================================================
// TypeScript Types
// ============================================================================

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert
export type KnowledgeGraphEntity = typeof knowledgeGraph.$inferSelect
export type NewKnowledgeGraphEntity = typeof knowledgeGraph.$inferInsert
export type KnowledgeGraphRelation = typeof graphRelations.$inferSelect
export type NewKnowledgeGraphRelation = typeof graphRelations.$inferInsert
export type RetrievalSession = typeof retrievalSessions.$inferSelect
export type NewRetrievalSession = typeof retrievalSessions.$inferInsert
export type RetrievalResult = typeof retrievalResults.$inferSelect
export type NewRetrievalResult = typeof retrievalResults.$inferInsert
export type EmbeddingShard = typeof embeddingShards.$inferSelect
export type NewEmbeddingShard = typeof embeddingShards.$inferInsert
export type DocumentShardMapping = typeof documentShardMappings.$inferSelect
export type NewDocumentShardMapping = typeof documentShardMappings.$inferInsert

// ============================================================================
// TypeScript Enums for Frontend Use (camelCase)
// ============================================================================

export enum Granularity {
  Fine = 'fine',
  Coarse = 'coarse'
}

export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard'
}

export enum Strategy {
  RetrieveRead = 'retrieve_read',
  Hybrid = 'hybrid',
  TwoStageRerank = 'two_stage_rerank',
  FusionInDecoder = 'fusion_in_decoder',
  AugmentedReranking = 'augmented_reranking',
  Federated = 'federated',
  GraphRag = 'graph_rag',
  Adaptive = 'adaptive'
}

export enum QueryType {
  Factual = 'factual',
  Analytical = 'analytical',
  Creative = 'creative',
  Comparison = 'comparison',
  Summarization = 'summarization',
  Reasoning = 'reasoning'
}

export enum EntityType {
  Concept = 'concept',
  Person = 'person',
  Organization = 'organization',
  Location = 'location',
  Event = 'event',
  Product = 'product',
  Technology = 'technology',
  Methodology = 'methodology',
  Process = 'process'
}

export enum ShardType {
  Domain = 'domain',
  Temporal = 'temporal',
  Source = 'source',
  Quality = 'quality',
  Language = 'language',
  Geographic = 'geographic'
}

export enum ContentType {
  Text = 'text',
  Code = 'code',
  Markdown = 'markdown',
  Json = 'json',
  Xml = 'xml',
  Html = 'html',
  Documentation = 'documentation',
  Article = 'article',
  Reference = 'reference'
}

export enum EmbeddingModel {
  TextEmbeddingAda002 = 'text-embedding-ada-002',
  TextEmbedding3Small = 'text-embedding-3-small',
  TextEmbedding3Large = 'text-embedding-3-large',
  AllMiniLML6V2 = 'all-MiniLM-L6-v2',
  AllMpnetBaseV2 = 'all-mpnet-base-v2',
  MultiQaMiniLML6CosV1 = 'multi-qa-MiniLM-L6-cos-v1'
}
