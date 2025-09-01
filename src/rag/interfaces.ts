/**
 * RAG Service Interface and Dependency Injection Container
 * Provides unified interface for all RAG operations with DI support
 */

import type { Database } from 'bun:sqlite'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type {
  RagQuery,
  RagResponse,
  RagStrategy,
  RagStrategyConfig,
  EmbeddingProvider,
  RetrieverInterface,
  DocumentProcessor,
  Reranker,
  RagSystemConfig,
  QueryAnalytics,
  ProcessedDocument,
  AdaptiveConfig
} from './types'

// ============================================================================
// Core RAG Service Interface
// ============================================================================

export interface RagService {
  // Primary retrieval operations
  retrieve(query: RagQuery): Promise<RagResponse>
  retrieveWithStrategy(query: RagQuery, strategy: RagStrategy, config?: Partial<RagStrategyConfig>): Promise<RagResponse>
  
  // Adaptive retrieval
  adaptiveRetrieve(query: RagQuery): Promise<RagResponse>
  
  // Multi-strategy ensemble
  ensembleRetrieve(query: RagQuery, strategies: RagStrategy[]): Promise<RagResponse>
  
  // Document operations
  addDocument(content: string, metadata?: Record<string, any>): Promise<string>
  addDocuments(documents: Array<{ content: string; metadata?: Record<string, any> }>): Promise<string[]>
  updateDocument(id: string, content: string, metadata?: Record<string, any>): Promise<void>
  deleteDocument(id: string): Promise<void>
  
  // Index operations
  rebuildIndex(strategy?: RagStrategy): Promise<void>
  optimizeIndex(): Promise<void>
  getIndexStats(): Promise<IndexStats>
  
  // Analytics and monitoring
  logQuery(analytics: QueryAnalytics): Promise<void>
  getQueryAnalytics(timeRange?: { start: Date; end: Date }): Promise<QueryAnalytics[]>
  getSystemMetrics(): Promise<SystemMetrics>
  
  // Health and lifecycle
  healthCheck(): Promise<HealthStatus>
  shutdown(): Promise<void>
}

// ============================================================================
// Dependency Injection Interfaces
// ============================================================================

export interface ServiceContainer {
  // Core services
  register<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void
  registerSingleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void
  registerInstance<T>(token: ServiceToken<T>, instance: T): void
  
  // Resolution
  resolve<T>(token: ServiceToken<T>): T
  resolveOptional<T>(token: ServiceToken<T>): T | undefined
  
  // Lifecycle
  dispose(): Promise<void>
}

export type ServiceToken<T = any> = string | symbol | { new (...args: any[]): T }
export type ServiceFactory<T> = (container: ServiceContainer) => T | Promise<T>

// ============================================================================
// Service Tokens (for DI)
// ============================================================================

export const SERVICE_TOKENS = {
  // Core infrastructure
  DATABASE: Symbol('Database'),
  CONFIG: Symbol('RagSystemConfig'),
  LOGGER: Symbol('Logger'),
  
  // Embedding providers
  EMBEDDING_PROVIDER: Symbol('EmbeddingProvider'),
  QUERY_ENCODER: Symbol('QueryEncoder'),
  DOCUMENT_ENCODER: Symbol('DocumentEncoder'),
  
  // Retrievers
  RETRIEVE_READ_RETRIEVER: Symbol('RetrieveReadRetriever'),
  HYBRID_RETRIEVER: Symbol('HybridRetriever'),
  TWO_STAGE_RETRIEVER: Symbol('TwoStageRetriever'),
  FUSION_RETRIEVER: Symbol('FusionRetriever'),
  AUGMENTED_RETRIEVER: Symbol('AugmentedRetriever'),
  FEDERATED_RETRIEVER: Symbol('FederatedRetriever'),
  GRAPH_RETRIEVER: Symbol('GraphRetriever'),
  ADAPTIVE_RETRIEVER: Symbol('AdaptiveRetriever'),
  
  // Processing services
  DOCUMENT_PROCESSOR: Symbol('DocumentProcessor'),
  CHUNK_PROCESSOR: Symbol('ChunkProcessor'),
  ENTITY_EXTRACTOR: Symbol('EntityExtractor'),
  
  // Reranking and fusion
  CROSS_ENCODER_RERANKER: Symbol('CrossEncoderReranker'),
  FUSION_STRATEGY: Symbol('FusionStrategy'),
  
  // Analytics and monitoring
  QUERY_ANALYZER: Symbol('QueryAnalyzer'),
  METRICS_COLLECTOR: Symbol('MetricsCollector'),
  
  // Main RAG service
  RAG_SERVICE: Symbol('RagService')
} as const

// ============================================================================
// Service Interfaces
// ============================================================================

export interface Logger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
}

export interface QueryAnalyzer {
  analyzeQuery(query: string): Promise<QueryAnalysis>
  classifyDifficulty(query: string): Promise<'easy' | 'medium' | 'hard'>
  extractIntent(query: string): Promise<QueryIntent>
  selectOptimalStrategy(query: RagQuery): Promise<RagStrategy>
}

export interface QueryAnalysis {
  type: 'factual' | 'analytical' | 'creative' | 'comparison' | 'summarization'
  difficulty: 'easy' | 'medium' | 'hard'
  complexity: number
  entities: string[]
  keywords: string[]
  intent: QueryIntent
  suggestedStrategy: RagStrategy
  confidence: number
}

export interface QueryIntent {
  primary: string
  secondary?: string[]
  domain: string
  temporality: 'current' | 'historical' | 'future' | 'timeless'
  specificity: 'general' | 'specific' | 'highly_specific'
}

export interface MetricsCollector {
  recordQuery(analytics: QueryAnalytics): Promise<void>
  recordLatency(operation: string, latency: number): Promise<void>
  recordError(operation: string, error: Error): Promise<void>
  
  getMetrics(timeRange?: { start: Date; end: Date }): Promise<SystemMetrics>
  getAggregatedMetrics(granularity: 'hour' | 'day' | 'week'): Promise<AggregatedMetrics>
}

// ============================================================================
// Statistics and Monitoring Types
// ============================================================================

export interface IndexStats {
  strategy: RagStrategy
  documentCount: number
  chunkCount: number
  embeddingDimensions: number
  indexSize: number
  lastUpdated: Date
  
  // Performance metrics
  averageQueryTime: number
  indexEfficiency: number
  memoryUsage: number
  
  // Quality metrics
  averageRecall: number
  averagePrecision: number
  
  // Shard-specific stats (for federated)
  shardStats?: ShardStats[]
}

export interface ShardStats {
  shardId: string
  documentCount: number
  indexSize: number
  queryLatency: number
  hitRate: number
  domain?: string
  quality: number
}

export interface SystemMetrics {
  // Query volume
  totalQueries: number
  queriesPerSecond: number
  
  // Performance
  averageLatency: number
  p95Latency: number
  p99Latency: number
  
  // Strategy usage
  strategyDistribution: Record<RagStrategy, number>
  
  // Quality
  averageConfidence: number
  userSatisfaction?: number
  
  // Resource usage
  memoryUsage: number
  diskUsage: number
  cpuUsage: number
  
  // Error rates
  errorRate: number
  timeoutRate: number
  
  timestamp: Date
}

export interface AggregatedMetrics {
  timeRange: { start: Date; end: Date }
  granularity: 'hour' | 'day' | 'week'
  
  dataPoints: Array<{
    timestamp: Date
    metrics: SystemMetrics
  }>
  
  // Trends
  trends: {
    queryVolume: 'increasing' | 'decreasing' | 'stable'
    latency: 'improving' | 'degrading' | 'stable'
    quality: 'improving' | 'degrading' | 'stable'
  }
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  
  components: {
    database: ComponentHealth
    embeddings: ComponentHealth
    retrieval: ComponentHealth
    processing: ComponentHealth
  }
  
  overall: {
    uptime: number
    version: string
    lastCheck: Date
  }
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency?: number
  errorRate?: number
  message?: string
  lastCheck: Date
}

// ============================================================================
// Abstract Base Classes
// ============================================================================

export abstract class BaseRetriever implements RetrieverInterface {
  abstract strategy: RagStrategy
  abstract name: string
  
  protected container: ServiceContainer
  protected config: RagStrategyConfig
  protected logger: Logger
  
  constructor(container: ServiceContainer, config: RagStrategyConfig) {
    this.container = container
    this.config = config
    this.logger = container.resolve(SERVICE_TOKENS.LOGGER)
  }
  
  abstract retrieve(query: RagQuery, config: RagStrategyConfig): Promise<RagResponse>
  
  async healthCheck(): Promise<boolean> {
    try {
      // Basic health check - override in implementations
      return true
    } catch (error) {
      this.logger.error(`Health check failed for ${this.name}`, error)
      return false
    }
  }
  
  abstract getMetrics(): Promise<any>
}

export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  abstract name: string
  abstract model: string
  abstract dimensions: number
  abstract maxTokens: number
  
  protected logger: Logger
  
  constructor(logger: Logger) {
    this.logger = logger
  }
  
  abstract generateEmbedding(text: string): Promise<number[]>
  abstract generateEmbeddings(texts: string[]): Promise<number[][]>
  
  // Optional query/document specific encoding
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.generateEmbedding(query)
  }
  
  async generateDocumentEmbedding(document: string): Promise<number[]> {
    return this.generateEmbedding(document)
  }
}

// ============================================================================
// Factory Interfaces
// ============================================================================

export interface RetrieverFactory {
  createRetriever(strategy: RagStrategy, config: RagStrategyConfig): RetrieverInterface
  getSupportedStrategies(): RagStrategy[]
}

export interface EmbeddingProviderFactory {
  createProvider(providerName: string, config: any): EmbeddingProvider
  getSupportedProviders(): string[]
}

// ============================================================================
// Configuration Validation
// ============================================================================

export interface ConfigValidator {
  validateConfig(config: RagSystemConfig): ValidationResult
  validateStrategyConfig(strategy: RagStrategy, config: RagStrategyConfig): ValidationResult
  validateAdaptiveConfig(config: AdaptiveConfig): ValidationResult
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

// ============================================================================
// Event System for Real-time Updates
// ============================================================================

export interface EventEmitter {
  emit(event: string, data: any): void
  on(event: string, handler: (data: any) => void): void
  off(event: string, handler: (data: any) => void): void
}

export interface RagEvents {
  'query:start': { queryId: string; query: RagQuery }
  'query:complete': { queryId: string; response: RagResponse }
  'query:error': { queryId: string; error: Error }
  
  'document:added': { documentId: string; metadata: any }
  'document:updated': { documentId: string; metadata: any }
  'document:deleted': { documentId: string }
  
  'index:rebuild': { strategy: RagStrategy; stats: IndexStats }
  'index:optimized': { strategy: RagStrategy; improvementPercent: number }
  
  'health:degraded': { component: string; status: ComponentHealth }
  'health:recovered': { component: string; status: ComponentHealth }
  
  'metrics:updated': { metrics: SystemMetrics }
}

// ============================================================================
// Plugin System for Extensibility
// ============================================================================

export interface RagPlugin {
  name: string
  version: string
  
  install(container: ServiceContainer): Promise<void>
  uninstall(container: ServiceContainer): Promise<void>
  
  configure?(config: any): void
  healthCheck?(): Promise<boolean>
}

export interface PluginManager {
  registerPlugin(plugin: RagPlugin): Promise<void>
  unregisterPlugin(pluginName: string): Promise<void>
  getPlugins(): RagPlugin[]
  getPlugin(name: string): RagPlugin | undefined
}
