/**
 * Database Schema for RAG Systems with pgvector
 * Supports multiple retrieval strategies and adaptive granularity
 * Using snake_case for database columns, camelCase for TypeScript
 * Supports dual-database operation with Neo4j integration
 */

import { relations } from 'drizzle-orm'
import { customType, index, integer, jsonb, pgEnum, pgSchema, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// ============================================================================
// Database Schemas for Multi-Database Support
// ============================================================================

// Public schema - traditional relational data with basic graph support
// @ts-ignore
export const publicSchema = pgSchema()

// Graph public schema - optimized for graph operations and Neo4j sync
export const graphPublicSchema = pgSchema('graph_public')

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
// Core Document Management (Public Schema - Basic Graph Support)
// ============================================================================

export const documents = publicSchema.table('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull().unique(),
  source: text('source'), // URL, file path, etc.
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  
  // Embedding model tracking for traceability
  embeddingModel: embeddingModelEnum('embedding_model').notNull(),
  embeddingModelVersion: text('embedding_model_version').notNull(),
  
  // Neo4j sync fields
  neo4jNodeId: text('neo4j_node_id'), // Reference to Neo4j node
  syncedToNeo4j: timestamp('synced_to_neo4j'),
  useGraphDatabase: integer('use_graph_database').default(0), // 0 = false, 1 = true
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  indexedAt: timestamp('indexed_at'),
}, (table) => ([
  index('documents_source_idx').on(table.source),
  index('documents_embedding_model_idx').on(table.embeddingModel),
  index('documents_content_hash_idx').on(table.contentHash),
  index('documents_neo4j_node_id_idx').on(table.neo4jNodeId),
  index('documents_use_graph_idx').on(table.useGraphDatabase),
]))

// ============================================================================
// Adaptive Retrieval Granularity - Dual Resolution Chunks (Public Schema)
// ============================================================================

export const documentChunks = publicSchema.table('document_chunks', {
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
  
  // Neo4j sync fields
  neo4jNodeId: text('neo4j_node_id'), // Reference to Neo4j node
  syncedToNeo4j: timestamp('synced_to_neo4j'),
  useGraphDatabase: integer('use_graph_database').default(0), // 0 = false, 1 = true
  
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
  index('chunks_neo4j_node_id_idx').on(table.neo4jNodeId),
  index('chunks_use_graph_idx').on(table.useGraphDatabase),
]))

// ============================================================================
// Knowledge Graph (Public Schema) - Traditional graph support
// ============================================================================

export const knowledgeGraph = publicSchema.table('knowledge_graph', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Entity information
  entityId: text('entity_id').notNull().unique(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityName: text('entity_name').notNull(),
  
  // Vector representation of entity
  embedding: vector('embedding', { dimensions: 1536 }),
  
  // Neo4j synchronization
  neo4jNodeId: text('neo4j_node_id').unique(),
  lastSyncedToNeo4j: timestamp('last_synced_to_neo4j'),
  neo4jVersion: integer('neo4j_version').default(0),
  
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
  index('kg_neo4j_node_idx').on(table.neo4jNodeId),
]))

export const graphRelations = publicSchema.table('knowledge_graph_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  sourceEntityId: text('source_entity_id').references(() => knowledgeGraph.entityId, { onDelete: 'cascade' }).notNull(),
  targetEntityId: text('target_entity_id').references(() => knowledgeGraph.entityId, { onDelete: 'cascade' }).notNull(),
  
  relationshipType: text('relationship_type').notNull(),
  relationshipStrength: real('relationship_strength').default(1.0),
  
  // Support for relation embeddings
  relationEmbedding: vector('relation_embedding', { dimensions: 1536 }),
  
  // Neo4j synchronization
  neo4jRelationshipId: text('neo4j_relationship_id').unique(),
  lastSyncedToNeo4j: timestamp('last_synced_to_neo4j'),
  neo4jVersion: integer('neo4j_version').default(0),
  
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
  index('kg_relations_neo4j_idx').on(table.neo4jRelationshipId),
]))

// ============================================================================
// Graph Public Schema - Optimized for Neo4j Integration
// ============================================================================

// Graph-optimized documents table
export const graphDocuments = graphPublicSchema.table('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull().unique(),
  source: text('source'),
  
  // Enhanced metadata for graph operations
  metadata: jsonb('metadata').$type<{
    sourceType?: 'web' | 'file' | 'api' | 'manual'
    domain?: string
    language?: string
    authorId?: string
    organizationId?: string
    projectId?: string
    tags?: string[]
    // Graph analytics
    centralityScore?: number
    communityId?: string
    pageRank?: number
    // Citation data
    citationCount?: number
    citedByCount?: number
    [key: string]: any
  }>().default({}),
  
  // Embedding model tracking
  embeddingModel: embeddingModelEnum('embedding_model').notNull(),
  embeddingModelVersion: text('embedding_model_version').notNull(),
  
  // Neo4j synchronization
  neo4jNodeId: text('neo4j_node_id').notNull().unique(),
  lastSyncedToNeo4j: timestamp('last_synced_to_neo4j').defaultNow(),
  neo4jVersion: integer('neo4j_version').default(1),
  
  // Graph relationship counts (denormalized for performance)
  outgoingRelationshipCount: integer('outgoing_relationship_count').default(0),
  incomingRelationshipCount: integer('incoming_relationship_count').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  indexedAt: timestamp('indexed_at'),
}, (table) => ([
  index('graph_docs_neo4j_node_id_idx').on(table.neo4jNodeId),
  index('graph_docs_content_hash_idx').on(table.contentHash),
  index('graph_docs_domain_idx').on(table.metadata),
  index('graph_docs_centrality_idx').on(table.metadata),
  index('graph_docs_sync_idx').on(table.lastSyncedToNeo4j),
]))

// Graph-optimized chunks table
export const graphChunks = graphPublicSchema.table('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => graphDocuments.id, { onDelete: 'cascade' }).notNull(),
  
  // Content and positioning
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
  
  // Adaptive granularity support
  granularity: granularityEnum('granularity').notNull(),
  chunkSize: integer('chunk_size').notNull(),
  
  // Vector embeddings (mandatory for graph chunks)
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  
  // Enhanced metadata for graph context
  metadata: jsonb('metadata').$type<{
    parentChunkId?: string
    childChunkIds?: string[]
    siblingChunkIds?: string[]
    tokens?: number
    language?: string
    contentType?: ContentType
    difficulty?: Difficulty
    // Semantic relationships
    conceptIds?: string[]
    entityIds?: string[]
    topicIds?: string[]
    // Graph analytics
    semanticClusterId?: string
    importanceScore?: number
    similarityConnections?: Array<{
      chunkId: string
      similarity: number
      relationshipType: string
    }>
    [key: string]: any
  }>().default({}),
  
  // Neo4j synchronization
  neo4jNodeId: text('neo4j_node_id').notNull().unique(),
  lastSyncedToNeo4j: timestamp('last_synced_to_neo4j').defaultNow(),
  neo4jVersion: integer('neo4j_version').default(1),
  
  // Graph relationship counts
  semanticRelationshipCount: integer('semantic_relationship_count').default(0),
  entityRelationshipCount: integer('entity_relationship_count').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('graph_chunks_document_idx').on(table.documentId),
  index('graph_chunks_neo4j_node_id_idx').on(table.neo4jNodeId),
  index('graph_chunks_embedding_cosine_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  index('graph_chunks_granularity_idx').on(table.granularity),
  index('graph_chunks_semantic_cluster_idx').on(table.metadata),
  index('graph_chunks_sync_idx').on(table.lastSyncedToNeo4j),
]))

// Graph-optimized entities table
export const graphEntities = graphPublicSchema.table('entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Entity information
  entityId: text('entity_id').notNull().unique(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityName: text('entity_name').notNull(),
  
  // Vector representation of entity
  embedding: vector('embedding', { dimensions: 1536 }),
  
  // Enhanced graph metadata
  metadata: jsonb('metadata').$type<{
    aliases?: string[]
    description?: string
    confidence?: number
    extractedFrom?: string[]
    // Additional graph properties
    importance?: number
    centrality?: number
    clusterId?: string
    // Domain-specific properties
    domainSpecific?: {
      [domain: string]: any
    }
    // Graph analytics
    pageRank?: number
    betweennessCentrality?: number
    clusteringCoefficient?: number
    [key: string]: any
  }>().default({}),
  
  // Neo4j synchronization
  neo4jNodeId: text('neo4j_node_id').notNull().unique(),
  lastSyncedToNeo4j: timestamp('last_synced_to_neo4j').defaultNow(),
  neo4jVersion: integer('neo4j_version').default(1),
  
  // Graph statistics (denormalized for performance)
  incomingRelationCount: integer('incoming_relation_count').default(0),
  outgoingRelationCount: integer('outgoing_relation_count').default(0),
  totalMentionCount: integer('total_mention_count').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('graph_entities_entity_id_idx').on(table.entityId),
  index('graph_entities_type_idx').on(table.entityType),
  index('graph_entities_neo4j_node_id_idx').on(table.neo4jNodeId),
  index('graph_entities_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  index('graph_entities_importance_idx').on(table.metadata),
  index('graph_entities_sync_idx').on(table.lastSyncedToNeo4j),
]))

// Graph relationships table for complex relationship tracking
export const graphRelationships = graphPublicSchema.table('relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  sourceEntityId: text('source_entity_id').references(() => graphEntities.entityId, { onDelete: 'cascade' }).notNull(),
  targetEntityId: text('target_entity_id').references(() => graphEntities.entityId, { onDelete: 'cascade' }).notNull(),
  
  relationshipType: text('relationship_type').notNull(),
  relationshipStrength: real('relationship_strength').default(1.0),
  confidence: real('confidence').default(1.0),
  
  // Enhanced relationship properties
  metadata: jsonb('metadata').$type<{
    extractedFrom?: string[]
    bidirectional?: boolean
    temporal?: {
      validFrom?: string
      validTo?: string
    }
    context?: string[]
    evidence?: Array<{
      sourceId: string
      confidence: number
      extractionMethod: string
    }>
    [key: string]: any
  }>().default({}),
  
  // Neo4j synchronization
  neo4jRelationshipId: text('neo4j_relationship_id').notNull().unique(),
  lastSyncedToNeo4j: timestamp('last_synced_to_neo4j').defaultNow(),
  neo4jVersion: integer('neo4j_version').default(1),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('graph_rels_source_idx').on(table.sourceEntityId),
  index('graph_rels_target_idx').on(table.targetEntityId),
  index('graph_rels_type_idx').on(table.relationshipType),
  index('graph_rels_neo4j_id_idx').on(table.neo4jRelationshipId),
  index('graph_rels_strength_idx').on(table.relationshipStrength),
  index('graph_rels_sync_idx').on(table.lastSyncedToNeo4j),
  index('graph_rels_composite_idx').on(table.sourceEntityId, table.targetEntityId, table.relationshipType),
]))

// Database synchronization tracking
export const databaseSyncLog = graphPublicSchema.table('database_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  operation: text('operation').notNull(), // 'create', 'update', 'delete', 'sync'
  entityType: text('entity_type').notNull(), // 'document', 'chunk', 'entity', 'relationship'
  entityId: text('entity_id').notNull(),
  
  postgresData: jsonb('postgres_data'),
  neo4jData: jsonb('neo4j_data'),
  
  syncDirection: text('sync_direction').notNull(), // 'postgres_to_neo4j', 'neo4j_to_postgres', 'bidirectional'
  syncStatus: text('sync_status').notNull(), // 'pending', 'success', 'failed', 'conflict'
  
  errorMessage: text('error_message'),
  conflictResolution: text('conflict_resolution'), // 'postgres_wins', 'neo4j_wins', 'merge', 'manual'
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
}, (table) => ([
  index('sync_log_entity_type_idx').on(table.entityType),
  index('sync_log_entity_id_idx').on(table.entityId),
  index('sync_log_status_idx').on(table.syncStatus),
  index('sync_log_created_at_idx').on(table.createdAt),
  index('sync_log_direction_idx').on(table.syncDirection),
]))

// ============================================================================
// Retrieval Analytics and Optimization (Public Schema)
// ============================================================================

export const retrievalSessions = publicSchema.table('retrieval_sessions', {
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
  
  // Database routing information
  usedDatabase: text('used_database').notNull(), // 'postgres', 'neo4j', 'hybrid'
  graphTraversalDepth: integer('graph_traversal_depth'), // For graph queries
  
  // Performance metrics
  latencyMs: integer('latency_ms'),
  embeddingGenTime: integer('embedding_gen_time_ms'),
  retrievalTime: integer('retrieval_time_ms'),
  rerankingTime: integer('reranking_time_ms'),
  graphTraversalTime: integer('graph_traversal_time_ms'), // For Neo4j queries
  
  // Quality metrics
  resultsReturned: integer('results_returned'),
  userFeedback: integer('user_feedback'), // 1-5 rating
  
  metadata: jsonb('metadata').$type<{
    modelUsed?: string
    clientId?: string
    sessionId?: string
    neo4jQueries?: string[]
    postgresQueries?: string[]
    [key: string]: any
  }>().default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  index('retrieval_query_hash_idx').on(table.queryHash),
  index('retrieval_strategy_idx').on(table.strategy),
  index('retrieval_difficulty_idx').on(table.queryDifficulty),
  index('retrieval_created_at_idx').on(table.createdAt),
  index('retrieval_used_database_idx').on(table.usedDatabase),
]))

export const retrievalResults = publicSchema.table('retrieval_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => retrievalSessions.id, { onDelete: 'cascade' }).notNull(),
  
  // Result content - supporting both traditional and graph sources
  resultType: text('result_type').notNull(), // 'chunk', 'document', 'entity', 'relationship'
  sourceId: uuid('source_id').notNull(), // ID of the source item
  sourceTable: text('source_table').notNull(), // 'document_chunks', 'documents', 'graph_entities', etc.
  sourceSchema: text('source_schema').notNull().default('public'), // 'public', 'graph_public'
  
  // Traditional references (nullable for backward compatibility)
  chunkId: uuid('chunk_id').references(() => documentChunks.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').references(() => knowledgeGraph.entityId, { onDelete: 'cascade' }),
  
  // Database source information
  sourceDatabase: text('source_database').notNull(), // 'postgres', 'neo4j'
  neo4jNodeId: text('neo4j_node_id'), // If sourced from Neo4j
  graphPath: jsonb('graph_path').$type<{
    nodeIds?: string[]
    relationshipTypes?: string[]
    pathLength?: number
    [key: string]: any
  }>(), // Graph traversal path for graph results
  
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
  index('retrieval_results_source_idx').on(table.sourceId, table.sourceTable),
  index('retrieval_results_database_idx').on(table.sourceDatabase),
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
