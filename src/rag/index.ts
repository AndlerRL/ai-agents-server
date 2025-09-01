/**
 * RAG System Bootstrap
 * Sets up and configures the complete RAG system with dependency injection
 */

import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { 
  DIContainer, 
  ServiceRegistrar, 
  ContainerFactory,
  ConsoleLogger,
  defineService,
  registerServices
} from './container'
import { SERVICE_TOKENS } from './interfaces'
import { HuggingFaceEmbeddingProvider, createHuggingFaceProvider } from './providers/huggingface'
import { RetrieveReadRetriever } from './retrievers/retrieve-read'
import { MainRagService } from './service'
import type { RagSystemConfig, RagStrategy } from './types'

// ============================================================================
// Environment Configuration
// ============================================================================

export interface RagEnvironmentConfig {
  // Database
  databaseUrl?: string
  
  // Embedding Provider
  embeddingProvider?: 'huggingface'
  embeddingModel?: string
  huggingfaceApiKey?: string
  
  // RAG Configuration
  defaultStrategy?: RagStrategy
  defaultTopK?: number
  scoreThreshold?: number
  
  // Performance
  maxConnections?: number
  queryTimeout?: number
  
  // Security
  enablePiiDetection?: boolean
  encryptMetadata?: boolean
}

/**
 * Load configuration from environment variables
 */
function loadEnvironmentConfig(): RagEnvironmentConfig {
  return {
    databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    embeddingProvider: (process.env.RAG_EMBEDDING_PROVIDER as any) || 'huggingface',
    embeddingModel: process.env.RAG_EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
    huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY,
    defaultStrategy: (process.env.RAG_DEFAULT_STRATEGY as RagStrategy) || 'retrieve_read',
    defaultTopK: parseInt(process.env.RAG_DEFAULT_TOP_K || '5'),
    scoreThreshold: parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.5'),
    maxConnections: parseInt(process.env.RAG_DB_MAX_CONNECTIONS || '10'),
    queryTimeout: parseInt(process.env.RAG_DB_QUERY_TIMEOUT || '30000'),
    enablePiiDetection: process.env.RAG_ENABLE_PII_DETECTION === 'true',
    encryptMetadata: process.env.RAG_ENCRYPT_METADATA === 'true'
  }
}

// ============================================================================
// Simple Implementations for Missing Services
// ============================================================================

class SimpleQueryAnalyzer {
  async analyzeQuery(query: string) {
    // Simple rule-based analysis
    const wordCount = query.split(' ').length
    const hasComplexTerms = /\b(analyze|compare|synthesize|evaluate|complex|relationship)\b/i.test(query)
    
    return {
      type: hasComplexTerms ? 'analytical' : 'factual',
      difficulty: wordCount > 20 || hasComplexTerms ? 'hard' : wordCount > 10 ? 'medium' : 'easy',
      complexity: Math.min(wordCount / 10, 1),
      entities: this.extractEntities(query),
      keywords: this.extractKeywords(query),
      intent: {
        primary: 'information_retrieval',
        domain: 'general',
        temporality: 'timeless',
        specificity: wordCount > 15 ? 'specific' : 'general'
      },
      suggestedStrategy: hasComplexTerms ? 'two_stage_rerank' : 'retrieve_read',
      confidence: 0.8
    }
  }
  
  async classifyDifficulty(query: string): Promise<'easy' | 'medium' | 'hard'> {
    const analysis = await this.analyzeQuery(query)
    return analysis.difficulty as 'easy' | 'medium' | 'hard'
  }
  
  async extractIntent(query: string) {
    const analysis = await this.analyzeQuery(query)
    return analysis.intent
  }
  
  async selectOptimalStrategy(query: any): Promise<RagStrategy> {
    const analysis = await this.analyzeQuery(query.text)
    return analysis.suggestedStrategy as RagStrategy
  }
  
  private extractEntities(query: string): string[] {
    // Simple entity extraction - match capitalized words
    const entities = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
    return [...new Set(entities)]
  }
  
  private extractKeywords(query: string): string[] {
    // Simple keyword extraction - remove stop words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'])
    const words = query.toLowerCase().match(/\b\w+\b/g) || []
    return words.filter(word => !stopWords.has(word) && word.length > 2)
  }
}

class SimpleMetricsCollector {
  private queries: any[] = []
  
  async recordQuery(analytics: any): Promise<void> {
    this.queries.push({
      ...analytics,
      timestamp: analytics.timestamp || new Date()
    })
    
    // Keep only last 1000 queries
    if (this.queries.length > 1000) {
      this.queries = this.queries.slice(-1000)
    }
  }
  
  async recordLatency(operation: string, latency: number): Promise<void> {
    // Simple latency recording
  }
  
  async recordError(operation: string, error: Error): Promise<void> {
    console.error(`Operation ${operation} failed:`, error)
  }
  
  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<any> {
    const relevantQueries = timeRange 
      ? this.queries.filter(q => q.timestamp >= timeRange.start && q.timestamp <= timeRange.end)
      : this.queries
    
    if (relevantQueries.length === 0) {
      return {
        totalQueries: 0,
        queriesPerSecond: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        strategyDistribution: {},
        averageConfidence: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        diskUsage: 0,
        cpuUsage: 0,
        errorRate: 0,
        timeoutRate: 0,
        timestamp: new Date()
      }
    }
    
    const latencies = relevantQueries
      .map(q => q.performance?.totalLatency || 0)
      .sort((a, b) => a - b)
    
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
    const p95Index = Math.floor(latencies.length * 0.95)
    const p99Index = Math.floor(latencies.length * 0.99)
    
    // Strategy distribution
    const strategyDistribution: Record<string, number> = {}
    relevantQueries.forEach(q => {
      const strategy = q.retrieval?.strategy || 'unknown'
      strategyDistribution[strategy] = (strategyDistribution[strategy] || 0) + 1
    })
    
    return {
      totalQueries: relevantQueries.length,
      queriesPerSecond: relevantQueries.length / 60, // Rough approximation
      averageLatency: Math.round(avgLatency),
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      strategyDistribution,
      averageConfidence: relevantQueries.reduce((sum, q) => sum + (q.quality?.confidence || 0), 0) / relevantQueries.length,
      memoryUsage: process.memoryUsage().heapUsed,
      diskUsage: 0,
      cpuUsage: 0,
      errorRate: 0,
      timeoutRate: 0,
      timestamp: new Date()
    }
  }
  
  async getAggregatedMetrics(granularity: 'hour' | 'day' | 'week'): Promise<any> {
    return {
      timeRange: { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() },
      granularity,
      dataPoints: [],
      trends: {
        queryVolume: 'stable' as const,
        latency: 'stable' as const,
        quality: 'stable' as const
      }
    }
  }
}

// ============================================================================
// RAG System Factory
// ============================================================================

export class RagSystemFactory {
  private envConfig: RagEnvironmentConfig
  
  constructor(envConfig?: Partial<RagEnvironmentConfig>) {
    this.envConfig = { ...loadEnvironmentConfig(), ...envConfig }
  }
  
  /**
   * Create a fully configured RAG system
   */
  async createRagSystem(): Promise<MainRagService> {
    const container = new DIContainer()
    
    // Register core services
    await this.registerCoreServices(container)
    
    // Register embedding providers
    await this.registerEmbeddingProviders(container)
    
    // Register retrievers
    await this.registerRetrievers(container)
    
    // Register analytics services
    await this.registerAnalyticsServices(container)
    
    // Register main RAG service
    container.registerSingleton(
      SERVICE_TOKENS.RAG_SERVICE,
      (container) => new MainRagService(container)
    )
    
    return container.resolve(SERVICE_TOKENS.RAG_SERVICE)
  }
  
  /**
   * Register core infrastructure services
   */
  private async registerCoreServices(container: DIContainer): Promise<void> {
    // Logger
    container.registerSingleton(
      SERVICE_TOKENS.LOGGER,
      () => new ConsoleLogger('[RAG]')
    )
    
    // Database connection
    container.registerSingleton(
      SERVICE_TOKENS.DATABASE,
      () => this.createDatabaseConnection()
    )
    
    // Configuration
    container.registerSingleton(
      SERVICE_TOKENS.CONFIG,
      () => this.createRagConfig()
    )
  }
  
  /**
   * Register embedding providers
   */
  private async registerEmbeddingProviders(container: DIContainer): Promise<void> {
    container.registerSingleton(
      SERVICE_TOKENS.EMBEDDING_PROVIDER,
      (container) => {
        const logger = container.resolve(SERVICE_TOKENS.LOGGER) as any
        return createHuggingFaceProvider(
          this.envConfig.embeddingModel!,
          {
            apiKey: this.envConfig.huggingfaceApiKey,
            maxRetries: 3,
            timeout: 30000,
            batchSize: 10
          },
          logger
        )
      }
    )
  }
  
  /**
   * Register retriever implementations
   */
  private async registerRetrievers(container: DIContainer): Promise<void> {
    // Retrieve-Read retriever
    container.registerSingleton(
      SERVICE_TOKENS.RETRIEVE_READ_RETRIEVER,
      (container) => {
        const config = container.resolve(SERVICE_TOKENS.CONFIG) as RagSystemConfig
        const strategyConfig = config.retrieval.strategies?.retrieve_read || {
          strategy: 'retrieve_read' as RagStrategy,
          topK: this.envConfig.defaultTopK || 5,
          scoreThreshold: this.envConfig.scoreThreshold || 0.5
        }
        return new RetrieveReadRetriever(container, strategyConfig)
      }
    )
    
    // Placeholder for other retrievers
    // TODO: Implement hybrid, two-stage, fusion, etc.
  }
  
  /**
   * Register analytics and monitoring services
   */
  private async registerAnalyticsServices(container: DIContainer): Promise<void> {
    container.registerSingleton(
      SERVICE_TOKENS.QUERY_ANALYZER,
      () => new SimpleQueryAnalyzer()
    )
    
    container.registerSingleton(
      SERVICE_TOKENS.METRICS_COLLECTOR,
      () => new SimpleMetricsCollector()
    )
  }
  
  /**
   * Create database connection
   */
  private createDatabaseConnection() {
    if (!this.envConfig.databaseUrl) {
      throw new Error('Database URL not configured. Set DATABASE_URL or POSTGRES_URL environment variable.')
    }
    
    const pool = new Pool({
      connectionString: this.envConfig.databaseUrl,
      max: this.envConfig.maxConnections || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: this.envConfig.queryTimeout || 30000,
    })
    
    return drizzle(pool)
  }
  
  /**
   * Create RAG system configuration
   */
  private createRagConfig(): RagSystemConfig {
    return {
      embedding: {
        provider: this.envConfig.embeddingProvider || 'huggingface',
        model: this.envConfig.embeddingModel || 'all-MiniLM-L6-v2',
        dimensions: 384, // Default for MiniLM
        batchSize: 10,
        maxRetries: 3
      },
      
      database: {
        maxConnections: this.envConfig.maxConnections || 10,
        queryTimeout: this.envConfig.queryTimeout || 30000,
        indexType: 'hnsw',
        indexParameters: {
          m: 16,
          efConstruction: 200
        }
      },
      
      retrieval: {
        defaultStrategy: this.envConfig.defaultStrategy || 'retrieve_read',
        defaultTopK: this.envConfig.defaultTopK || 5,
        scoreThreshold: this.envConfig.scoreThreshold || 0.5,
        maxContextLength: 4000,
        strategies: {
          retrieve_read: {
            strategy: 'retrieve_read',
            topK: this.envConfig.defaultTopK || 5,
            scoreThreshold: this.envConfig.scoreThreshold || 0.5
          },
          hybrid: {
            strategy: 'hybrid',
            topK: this.envConfig.defaultTopK || 5,
            scoreThreshold: this.envConfig.scoreThreshold || 0.5,
            denseWeight: 0.7,
            sparseWeight: 0.3
          },
          two_stage_rerank: {
            strategy: 'two_stage_rerank',
            topK: this.envConfig.defaultTopK || 5,
            initialK: 20,
            rerankK: 5,
            crossEncoderModel: 'cross-encoder/ms-marco-MiniLM-L-6-v2'
          },
          fusion_in_decoder: {
            strategy: 'fusion_in_decoder',
            topK: this.envConfig.defaultTopK || 5,
            fusionMethod: 'weighted',
            maxPassages: 10
          },
          augmented_reranking: {
            strategy: 'augmented_reranking',
            topK: this.envConfig.defaultTopK || 5,
            expansionStrategy: 'parent_child',
            expansionRadius: 2
          },
          federated: {
            strategy: 'federated',
            topK: this.envConfig.defaultTopK || 5,
            shardSelection: 'adaptive',
            maxShards: 5
          },
          graph_rag: {
            strategy: 'graph_rag',
            topK: this.envConfig.defaultTopK || 5,
            maxHops: 3,
            relationshipWeights: { 'related_to': 1.0, 'part_of': 0.8 }
          },
          adaptive: {
            strategy: 'adaptive',
            topK: this.envConfig.defaultTopK || 5,
            adaptiveThresholds: {
              easyQuery: 0.8,
              mediumQuery: 0.6,
              hardQuery: 0.4
            }
          }
        }
      },
      
      processing: {
        chunkingStrategy: {
          name: 'adaptive',
          coarseSize: 1000,
          fineSize: 200,
          overlap: 50,
          method: 'semantic'
        },
        supportedFormats: ['txt', 'md', 'pdf', 'docx', 'html'],
        maxDocumentSize: 10 * 1024 * 1024, // 10MB
        parallelProcessing: true
      },
      
      performance: {
        cacheSize: 1000,
        cacheTimeout: 3600000, // 1 hour
        enableMetrics: true,
        metricsRetention: 7 * 24 * 60 * 60 * 1000 // 7 days
      },
      
      security: {
        enablePIIDetection: this.envConfig.enablePiiDetection || false,
        encryptMetadata: this.envConfig.encryptMetadata || false,
        accessControl: false,
        auditLogging: true
      }
    }
  }
}

// ============================================================================
// Bootstrap Functions
// ============================================================================

/**
 * Quick bootstrap for development and testing
 */
export async function bootstrapRagSystem(config?: Partial<RagEnvironmentConfig>): Promise<MainRagService> {
  const factory = new RagSystemFactory(config)
  return await factory.createRagSystem()
}

/**
 * Bootstrap with validation and health checks
 */
export async function bootstrapRagSystemWithValidation(config?: Partial<RagEnvironmentConfig>): Promise<MainRagService> {
  const ragService = await bootstrapRagSystem(config)
  
  // Perform health check
  const health = await ragService.healthCheck()
  if (health.status !== 'healthy') {
    throw new Error(`RAG system health check failed: ${JSON.stringify(health, null, 2)}`)
  }
  
  console.log('✅ RAG system bootstrapped successfully')
  console.log(`📊 Health status: ${health.status}`)
  console.log(`🔧 Components: ${Object.entries(health.components).map(([name, comp]) => `${name}:${comp.status}`).join(', ')}`)
  
  return ragService
}

/**
 * Bootstrap for production with all safety checks
 */
export async function bootstrapRagSystemProduction(config?: Partial<RagEnvironmentConfig>): Promise<MainRagService> {
  console.log('🚀 Bootstrapping RAG system for production...')
  
  // Validate required environment variables
  const envConfig = { ...loadEnvironmentConfig(), ...config }
  
  if (!envConfig.databaseUrl) {
    throw new Error('DATABASE_URL is required for production')
  }
  
  if (!envConfig.huggingfaceApiKey) {
    console.warn('⚠️  HUGGINGFACE_API_KEY not set - some embedding models may not work')
  }
  
  // Bootstrap with validation
  const ragService = await bootstrapRagSystemWithValidation(config)
  
  // Additional production checks
  const indexStats = await ragService.getIndexStats()
  console.log(`📈 Index stats: ${indexStats.documentCount} documents, ${indexStats.chunkCount} chunks`)
  
  // Register shutdown handlers
  process.on('SIGTERM', async () => {
    console.log('🛑 Graceful shutdown...')
    await ragService.shutdown()
    process.exit(0)
  })
  
  process.on('SIGINT', async () => {
    console.log('🛑 Graceful shutdown...')
    await ragService.shutdown()
    process.exit(0)
  })
  
  console.log('✅ RAG system ready for production')
  
  return ragService
}

// ============================================================================
// Exports
// ============================================================================

export { MainRagService } from './service'
export { HuggingFaceEmbeddingProvider } from './providers/huggingface'
export { RetrieveReadRetriever } from './retrievers/retrieve-read'
export * from './types'
export * from './interfaces'
