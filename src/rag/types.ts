/**
 * RAG System Core Types and Interfaces
 * Defines the contract for all RAG implementations
 */

// ============================================================================
// Query and Response Types
// ============================================================================

export interface RagQuery {
  text: string
  queryId?: string
  sessionId?: string
  clientId?: string
  
  // Query characteristics
  type?: 'factual' | 'analytical' | 'creative' | 'comparison' | 'summarization'
  difficulty?: 'easy' | 'medium' | 'hard'
  
  // Retrieval parameters
  topK?: number
  granularity?: 'coarse' | 'fine' | 'adaptive'
  strategy?: RagStrategy
  
  // Filtering and routing
  filters?: QueryFilters
  shards?: string[]
  
  // Context and preferences
  contextWindow?: number
  includeMetadata?: boolean
  explainResults?: boolean
  
  metadata?: Record<string, any>
}

export interface QueryFilters {
  dateRange?: { start: Date; end: Date }
  sources?: string[]
  domains?: string[]
  contentTypes?: string[]
  languages?: string[]
  minQuality?: number
  entityTypes?: string[]
  
  // Custom filters
  [key: string]: any
}

export interface RagResponse {
  queryId: string
  results: RetrievalResult[]
  
  // Performance metrics
  totalLatency: number
  embeddingLatency: number
  retrievalLatency: number
  rerankingLatency?: number
  
  // Metadata
  strategy: RagStrategy
  topK: number
  granularity: string
  
  // Quality indicators
  confidence: number
  coverage: number
  
  // Debugging and explanation
  explanation?: string
  debugInfo?: DebugInfo
  
  metadata?: Record<string, any>
}

export interface RetrievalResult {
  id: string
  content: string
  score: number
  rank: number
  
  // Source information
  documentId: string
  chunkId?: string
  entityId?: string
  
  // Scoring breakdown
  denseScore?: number
  sparseScore?: number
  hybridScore?: number
  rerankScore?: number
  
  // Context
  metadata: Record<string, any>
  
  // For GraphRAG
  entityType?: string
  relationshipPath?: string[]
  
  // For adaptive granularity
  chunkGranularity?: 'coarse' | 'fine'
  expandedContext?: string
}

export interface DebugInfo {
  queryDifficulty: string
  strategyReasoning: string
  shardRouting: string[]
  indexUsed: string
  candidatesRetrieved: number
  reranked: boolean
  fallbackUsed: boolean
  
  timingBreakdown: {
    embedding: number
    retrieval: number
    reranking?: number
    postProcessing: number
  }
  
  scoringDetails: {
    normalizedScores: boolean
    hybridWeights?: { dense: number; sparse: number }
    rerankingModel?: string
  }
}

// ============================================================================
// RAG Strategy Types
// ============================================================================

export type RagStrategy = 
  | 'retrieve_read'                    // Standard retrieve-then-read
  | 'hybrid'                          // Sparse + Dense hybrid
  | 'two_stage_rerank'                // Two-stage with cross-encoder
  | 'fusion_in_decoder'               // Multi-passage fusion
  | 'augmented_reranking'             // With context expansion
  | 'federated'                       // Across embedding shards
  | 'graph_rag'                       // Knowledge graph based
  | 'adaptive'                        // Dynamic strategy selection

export interface RagStrategyConfig {
  strategy: RagStrategy
  
  // Common parameters
  topK: number
  scoreThreshold?: number
  
  // Hybrid retrieval
  denseWeight?: number
  sparseWeight?: number
  
  // Two-stage reranking
  initialK?: number
  rerankK?: number
  crossEncoderModel?: string
  
  // Fusion strategies
  fusionMethod?: 'weighted' | 'attention' | 'voting'
  maxPassages?: number
  
  // Context expansion
  expansionRadius?: number
  expansionStrategy?: 'parent_child' | 'sliding_window' | 'semantic_neighbors'
  
  // Federated retrieval
  shardSelection?: 'all' | 'quality_based' | 'domain_based' | 'adaptive'
  maxShards?: number
  
  // GraphRAG
  maxHops?: number
  relationshipWeights?: Record<string, number>
  entityTypes?: string[]
  
  // Adaptive parameters
  adaptiveThresholds?: {
    easyQuery: number
    mediumQuery: number
    hardQuery: number
  }
  
  metadata?: Record<string, any>
}

// ============================================================================
// Embedding and Retrieval Interfaces
// ============================================================================

export interface EmbeddingProvider {
  name: string
  model: string
  dimensions: number
  maxTokens: number
  costPerToken?: number
  
  generateEmbedding(text: string): Promise<number[]>
  generateEmbeddings(texts: string[]): Promise<number[][]>
  
  // For instruction-tuned models
  generateQueryEmbedding?(query: string): Promise<number[]>
  generateDocumentEmbedding?(document: string): Promise<number[]>
}

export interface RetrieverInterface {
  strategy: RagStrategy
  name: string
  
  retrieve(query: RagQuery, config: RagStrategyConfig): Promise<RagResponse>
  
  // Health and performance
  healthCheck(): Promise<boolean>
  getMetrics(): Promise<RetrieverMetrics>
}

export interface RetrieverMetrics {
  totalQueries: number
  averageLatency: number
  p95Latency: number
  p99Latency: number
  errorRate: number
  
  // Quality metrics
  averageRecall: number
  averagePrecision: number
  averageMRR: number
  
  // Resource usage
  memoryUsage: number
  indexSize: number
  cacheHitRate: number
  
  lastUpdated: Date
}

// ============================================================================
// Document Processing Types
// ============================================================================

export interface DocumentProcessor {
  name: string
  supportedTypes: string[]
  
  processDocument(content: string, metadata?: Record<string, any>): Promise<ProcessedDocument>
  extractText(content: string, type: string): Promise<string>
  
  // Chunking strategies
  chunkDocument(content: string, strategy: ChunkingStrategy): Promise<DocumentChunk[]>
}

export interface ProcessedDocument {
  id: string
  title: string
  content: string
  contentHash: string
  
  metadata: {
    source?: string
    contentType?: string
    language?: string
    extractedAt: Date
    processingTime: number
    [key: string]: any
  }
  
  // Chunking results
  coarseChunks: DocumentChunk[]
  fineChunks: DocumentChunk[]
  
  // Extracted entities for GraphRAG
  entities?: ExtractedEntity[]
  relationships?: ExtractedRelationship[]
}

export interface DocumentChunk {
  id: string
  content: string
  startOffset: number
  endOffset: number
  chunkIndex: number
  granularity: 'coarse' | 'fine'
  
  metadata: {
    tokens: number
    language?: string
    contentType?: string
    parentChunkId?: string
    childChunkIds?: string[]
    difficulty?: 'easy' | 'medium' | 'hard'
    [key: string]: any
  }
}

export interface ChunkingStrategy {
  name: string
  coarseSize: number
  fineSize: number
  overlap: number
  method: 'fixed' | 'semantic' | 'sentence' | 'paragraph' | 'adaptive'
  
  // Semantic chunking parameters
  similarityThreshold?: number
  minChunkSize?: number
  maxChunkSize?: number
  
  // Adaptive chunking
  difficultyBasedSizing?: boolean
  contentTypeAdaptation?: boolean
}

// ============================================================================
// Knowledge Graph Types
// ============================================================================

export interface ExtractedEntity {
  id: string
  name: string
  type: string
  aliases: string[]
  description?: string
  confidence: number
  
  metadata: {
    extractedFrom: string[]
    sourceOffsets: Array<{ start: number; end: number }>
    [key: string]: any
  }
}

export interface ExtractedRelationship {
  id: string
  sourceEntityId: string
  targetEntityId: string
  relationshipType: string
  strength: number
  confidence: number
  bidirectional: boolean
  
  metadata: {
    extractedFrom: string[]
    evidence: string[]
    [key: string]: any
  }
}

export interface GraphRetrieval {
  entities: ExtractedEntity[]
  relationships: ExtractedRelationship[]
  
  // Path information
  paths: GraphPath[]
  centralEntities: string[]
  
  // Subgraph statistics
  nodeCount: number
  edgeCount: number
  maxHops: number
  
  confidence: number
}

export interface GraphPath {
  entities: string[]
  relationships: string[]
  pathLength: number
  pathScore: number
  pathType: 'direct' | 'transitive' | 'semantic'
}

// ============================================================================
// Reranking and Fusion Types
// ============================================================================

export interface Reranker {
  name: string
  model: string
  
  rerank(query: string, results: RetrievalResult[], topK: number): Promise<RetrievalResult[]>
  
  // Cross-encoder specific
  computePairwiseScores?(query: string, documents: string[]): Promise<number[]>
}

export interface FusionStrategy {
  name: string
  method: 'weighted' | 'attention' | 'voting' | 'rrf' // RRF = Reciprocal Rank Fusion
  
  fuse(results: RetrievalResult[][], weights?: number[]): Promise<RetrievalResult[]>
  
  // Voting-based fusion
  votingThreshold?: number
  consensusRequired?: boolean
}

// ============================================================================
// Monitoring and Analytics Types
// ============================================================================

export interface QueryAnalytics {
  queryId: string
  sessionId?: string
  timestamp: Date
  
  query: {
    text: string
    type: string
    difficulty: string
    length: number
  }
  
  retrieval: {
    strategy: RagStrategy
    topK: number
    granularity: string
    shardsUsed: string[]
  }
  
  performance: {
    totalLatency: number
    embeddingLatency: number
    retrievalLatency: number
    rerankingLatency?: number
    resultsReturned: number
  }
  
  quality: {
    userFeedback?: number
    confidence: number
    coverage: number
    recall?: number
    precision?: number
  }
  
  metadata: Record<string, any>
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface RagSystemConfig {
  // Embedding configuration
  embedding: {
    provider: string
    model: string
    dimensions: number
    batchSize: number
    maxRetries: number
  }
  
  // Database configuration
  database: {
    maxConnections: number
    queryTimeout: number
    indexType: 'hnsw' | 'ivfflat'
    indexParameters: Record<string, any>
  }
  
  // Retrieval configuration
  retrieval: {
    defaultStrategy: RagStrategy
    defaultTopK: number
    scoreThreshold: number
    maxContextLength: number
    
    // Strategy-specific configs
    strategies: Record<RagStrategy, RagStrategyConfig>
  }
  
  // Processing configuration
  processing: {
    chunkingStrategy: ChunkingStrategy
    supportedFormats: string[]
    maxDocumentSize: number
    parallelProcessing: boolean
  }
  
  // Performance configuration
  performance: {
    cacheSize: number
    cacheTimeout: number
    enableMetrics: boolean
    metricsRetention: number
  }
  
  // Security configuration
  security: {
    enablePIIDetection: boolean
    encryptMetadata: boolean
    accessControl: boolean
    auditLogging: boolean
  }
}

export interface AdaptiveConfig {
  // Query routing thresholds
  difficultyThresholds: {
    easy: { maxLength: number; lexicalOverlap: number }
    medium: { maxLength: number; lexicalOverlap: number }
    hard: { maxLength: number; lexicalOverlap: number }
  }
  
  // Strategy routing
  strategyRouting: {
    easy: { strategy: RagStrategy; topK: number; granularity: 'coarse' }
    medium: { strategy: RagStrategy; topK: number; granularity: 'fine' }
    hard: { strategy: RagStrategy; topK: number; granularity: 'adaptive' }
  }
  
  // Dynamic parameters
  dynamicK: {
    min: number
    max: number
    stepSize: number
  }
  
  // Uncertainty estimation
  uncertaintyModel: {
    enabled: boolean
    threshold: number
    features: string[]
  }
}
