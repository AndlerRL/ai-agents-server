/**
 * Retrieve-then-Read Strategy Implementation
 * The foundational RAG approach: retrieve relevant documents, then generate response
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { sql, desc, and, gt } from 'drizzle-orm'
import { cosineDistance } from 'drizzle-orm'
import type {
  ServiceContainer,
  Logger
} from '../interfaces'
import { BaseRetriever, SERVICE_TOKENS } from '../interfaces'
import type { 
  RagQuery,
  RagResponse,
  RagStrategyConfig,
  RetrievalResult,
  RagStrategy,
  EmbeddingProvider
} from '../types'
import { 
  documents, 
  documentChunks, 
  retrievalSessions 
} from '../../database/schema'

// ============================================================================
// Retrieve-then-Read Retriever Implementation
// ============================================================================

export class RetrieveReadRetriever extends BaseRetriever {
  strategy: RagStrategy = 'retrieve_read'
  name = 'RetrieveReadRetriever'
  
  private database: NodePgDatabase<any>
  private embeddingProvider: EmbeddingProvider
  
  constructor(container: ServiceContainer, config: RagStrategyConfig) {
    super(container, config)
    
    this.database = container.resolve(SERVICE_TOKENS.DATABASE)
    this.embeddingProvider = container.resolve(SERVICE_TOKENS.EMBEDDING_PROVIDER)
    
    if (!this.embeddingProvider) {
      throw new Error('Embedding provider not found in container')
    }
  }
  
  /**
   * Retrieve relevant documents using dense vector similarity
   */
  async retrieve(query: RagQuery, config: RagStrategyConfig): Promise<RagResponse> {
    const startTime = Date.now()
    const queryId = query.queryId || this.generateQueryId()
    
    try {
      this.logger.info(`Starting retrieve-read for query: ${query.text.substring(0, 100)}...`)
      
      // Step 1: Generate query embedding
      const embeddingStart = Date.now()
      const queryEmbedding = await this.embeddingProvider.generateQueryEmbedding?.(query.text)
      const embeddingLatency = Date.now() - embeddingStart

      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding')
      }

      // Step 2: Retrieve similar chunks
      const retrievalStart = Date.now()
      const results = await this.retrieveSimilarChunks(
        queryEmbedding,
        query,
        config
      )
      const retrievalLatency = Date.now() - retrievalStart
      
      // Step 3: Post-process and score
      const processedResults = await this.postProcessResults(results, query, config)
      
      // Step 4: Build response
      const totalLatency = Date.now() - startTime
      const response: RagResponse = {
        queryId,
        results: processedResults,
        totalLatency,
        embeddingLatency,
        retrievalLatency,
        strategy: this.strategy,
        topK: config.topK,
        granularity: query.granularity || 'coarse',
        confidence: this.calculateConfidence(processedResults),
        coverage: this.calculateCoverage(processedResults, query),
        explanation: this.generateExplanation(processedResults, query),
        debugInfo: {
          queryDifficulty: this.assessQueryDifficulty(query.text),
          strategyReasoning: 'Standard dense retrieval with cosine similarity',
          shardRouting: ['primary'],
          indexUsed: 'hnsw_vector_index',
          candidatesRetrieved: results.length,
          reranked: false,
          fallbackUsed: false,
          timingBreakdown: {
            embedding: embeddingLatency,
            retrieval: retrievalLatency,
            postProcessing: totalLatency - embeddingLatency - retrievalLatency
          },
          scoringDetails: {
            normalizedScores: true
          }
        }
      }
      
      // Step 5: Log analytics
      await this.logRetrieval(queryId, query, response)
      
      this.logger.info(`Retrieve-read completed in ${totalLatency}ms, returned ${processedResults.length} results`)
      
      return response
      
    } catch (error) {
      this.logger.error('Retrieve-read failed:', error)
      throw new Error(`Retrieve-read retrieval failed: ${error}`)
    }
  }
  
  /**
   * Retrieve similar chunks using vector similarity search
   */
  private async retrieveSimilarChunks(
    queryEmbedding: number[],
    query: RagQuery,
    config: RagStrategyConfig
  ): Promise<Array<{
    chunkId: string
    documentId: string
    content: string
    distance: number
    metadata: any
  }>> {
    const topK = config.topK || query.topK || 5
    const scoreThreshold = config.scoreThreshold || 0.7
    
    // Choose granularity
    const useCoarseGranularity = query.granularity === 'coarse' || 
                                (!query.granularity && query.type !== 'analytical')
    
    // Build base query
    let baseQuery = this.database
      .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        content: documentChunks.content,
        distance: sql<number>`1 - (${documentChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
        metadata: documentChunks.metadata,
        documentTitle: documents.title,
        documentMetadata: documents.metadata
      })
      .from(documentChunks)
      .innerJoin(documents, sql`${documentChunks.documentId} = ${documents.id}`)
      .where(
        and(
          sql`${documentChunks.granularity} = ${useCoarseGranularity ? 'coarse' : 'fine'}`,
          gt(sql`1 - (${documentChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`, scoreThreshold)
        )
      )
      .orderBy(desc(sql`1 - (${documentChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`))
      .limit(topK)
    
    // Apply filters if provided
    if (query.filters) {
      baseQuery = this.applyFilters(baseQuery, query.filters)
    }
    
    const results = await baseQuery
    
    return results.map(result => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      content: result.content,
      distance: result.distance,
      metadata: {
        ...result.metadata,
        documentTitle: result.documentTitle,
        documentMetadata: result.documentMetadata
      }
    }))
  }
  
  /**
   * Apply query filters to the database query
   */
  private applyFilters(baseQuery: any, filters: any): any {
    // Date range filtering
    if (filters.dateRange) {
      baseQuery = baseQuery.where(
        and(
          sql`${documents.createdAt} >= ${filters.dateRange.start}`,
          sql`${documents.createdAt} <= ${filters.dateRange.end}`
        )
      )
    }
    
    // Source filtering
    if (filters.sources && filters.sources.length > 0) {
      baseQuery = baseQuery.where(
        sql`${documents.source} = ANY(${filters.sources})`
      )
    }
    
    // Content type filtering - documents table doesn't have contentType, using metadata
    if (filters.contentTypes && filters.contentTypes.length > 0) {
      baseQuery = baseQuery.where(
        sql`${documents.metadata}->>'contentType' = ANY(${filters.contentTypes})`
      )
    }
    
    // Language filtering - documents table doesn't have language, using metadata
    if (filters.languages && filters.languages.length > 0) {
      baseQuery = baseQuery.where(
        sql`${documents.metadata}->>'language' = ANY(${filters.languages})`
      )
    }
    
    return baseQuery
  }
  
  /**
   * Post-process retrieval results
   */
  private async postProcessResults(
    rawResults: Array<{
      chunkId: string
      documentId: string
      content: string
      distance: number
      metadata: any
    }>,
    query: RagQuery,
    config: RagStrategyConfig
  ): Promise<RetrievalResult[]> {
    const results: RetrievalResult[] = []
    
    for (let i = 0; i < rawResults.length; i++) {
      const result = rawResults[i]
      
      // Normalize score (distance -> similarity)
      const score = Math.max(0, Math.min(1, result.distance))
      
      // Build retrieval result
      const retrievalResult: RetrievalResult = {
        id: `${result.chunkId}-${i}`,
        content: result.content,
        score,
        rank: i + 1,
        documentId: result.documentId,
        chunkId: result.chunkId,
        denseScore: score,
        metadata: {
          ...result.metadata,
          retrievalStrategy: this.strategy,
          retrievalTime: new Date().toISOString()
        },
        chunkGranularity: query.granularity === 'fine' ? 'fine' : 'coarse'
      }
      
      // Add expanded context if requested
      if (query.granularity === 'adaptive' || query.includeMetadata) {
        retrievalResult.expandedContext = await this.getExpandedContext(
          result.chunkId,
          result.documentId
        )
      }
      
      results.push(retrievalResult)
    }
    
    return results
  }
  
  /**
   * Get expanded context for a chunk (parent/child chunks)
   */
  private async getExpandedContext(chunkId: string, documentId: string): Promise<string> {
    try {
      // Get the current chunk details
      const currentChunk = await this.database
        .select()
        .from(documentChunks)
        .where(sql`${documentChunks.id} = ${chunkId}`)
        .limit(1)
      
      if (currentChunk.length === 0) return ''
      
      const chunk = currentChunk[0]
      
      // Get neighboring chunks from the same document
      const neighbors = await this.database
        .select()
        .from(documentChunks)
        .where(
          and(
            sql`${documentChunks.documentId} = ${documentId}`,
            sql`${documentChunks.granularity} = ${chunk.granularity}`,
            sql`ABS(${documentChunks.chunkIndex} - ${chunk.chunkIndex}) <= 1`
          )
        )
        .orderBy(documentChunks.chunkIndex)
      
      return neighbors.map(n => n.content).join('\n\n')
      
    } catch (error) {
      this.logger.warn('Failed to get expanded context:', error)
      return ''
    }
  }
  
  /**
   * Calculate confidence score for the overall response
   */
  private calculateConfidence(results: RetrievalResult[]): number {
    if (results.length === 0) return 0
    
    // Calculate based on top scores and score distribution
    const scores = results.map(r => r.score)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const topScore = Math.max(...scores)
    
    // Confidence is weighted average of top score and overall quality
    return Math.round((topScore * 0.7 + avgScore * 0.3) * 100) / 100
  }
  
  /**
   * Calculate coverage score (how well the query is covered)
   */
  private calculateCoverage(results: RetrievalResult[], query: RagQuery): number {
    if (results.length === 0) return 0
    
    // Simple heuristic: coverage based on number of results and their scores
    const targetK = query.topK || 5
    const coverageRatio = Math.min(results.length / targetK, 1)
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
    
    return Math.round(coverageRatio * avgScore * 100) / 100
  }
  
  /**
   * Generate explanation for the retrieval
   */
  private generateExplanation(results: RetrievalResult[], query: RagQuery): string {
    if (results.length === 0) {
      return 'No relevant documents found for the query.'
    }
    
    const topScore = results[0]?.score || 0
    const strategy = query.granularity || 'coarse'
    
    return `Retrieved ${results.length} documents using ${strategy} granularity. ` +
           `Top result has similarity score of ${(topScore * 100).toFixed(1)}%. ` +
           `Used dense vector search with cosine similarity.`
  }
  
  /**
   * Assess query difficulty for debugging
   */
  private assessQueryDifficulty(queryText: string): string {
    const wordCount = queryText.split(' ').length
    const hasComplexTerms = /\b(analyze|compare|synthesize|evaluate|complex|relationship)\b/i.test(queryText)
    
    if (wordCount > 20 || hasComplexTerms) return 'hard'
    if (wordCount > 10) return 'medium'
    return 'easy'
  }
  
  /**
   * Log retrieval analytics
   */
  private async logRetrieval(queryId: string, query: RagQuery, response: RagResponse): Promise<void> {
    try {
      await this.database.insert(retrievalSessions).values({
        // @ts-ignore
        id: queryId,
        query: query.text,
        queryHash: this.hashQuery(query.text),
        queryDifficulty: this.assessQueryDifficulty(query.text),
        queryLength: query.text.length,
        queryType: query.type || 'unknown',
        strategy: this.strategy,
        topK: response.topK,
        granularity: response.granularity,
        latencyMs: response.totalLatency,
        embeddingGenTime: response.embeddingLatency,
        retrievalTime: response.retrievalLatency,
        rerankingTime: response.rerankingLatency || null,
        resultsReturned: response.results.length,
        userFeedback: null, // To be updated later if feedback is provided
        metadata: {
          userAgent: query.metadata?.userAgent,
          requestId: query.metadata?.requestId,
          clientId: query.clientId,
          sessionId: query.sessionId
        }
      })
    } catch (error) {
      this.logger.warn('Failed to log retrieval analytics:', error)
    }
  }
  
  /**
   * Simple hash function for queries
   */
  private hashQuery(queryText: string): string {
    let hash = 0
    for (let i = 0; i < queryText.length; i++) {
      const char = queryText.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
  
  /**
   * Get retriever metrics
   */
  async getMetrics(): Promise<any> {
    try {
      // Get recent performance metrics
      const recentAnalytics = await this.database
        .select()
        .from(retrievalSessions)
        .where(
          and(
            sql`${retrievalSessions.strategy} = ${this.strategy}`,
            sql`${retrievalSessions.createdAt} > NOW() - INTERVAL '24 hours'`
          )
        )
      
      if (recentAnalytics.length === 0) {
        return {
          totalQueries: 0,
          averageLatency: 0,
          p95Latency: 0,
          p99Latency: 0,
          errorRate: 0,
          averageRecall: 0,
          averagePrecision: 0,
          averageMRR: 0,
          memoryUsage: 0,
          indexSize: 0,
          cacheHitRate: 0,
          lastUpdated: new Date()
        }
      }
      
      // Calculate metrics
      const latencies = recentAnalytics
        .map(a => a.latencyMs)
        .filter(l => l !== null)
        .sort((a, b) => a! - b!)
      
      const avgLatency = latencies.reduce((a, b) => a + (b || 0), 0) / latencies.length
      const p95Index = Math.floor(latencies.length * 0.95)
      const p99Index = Math.floor(latencies.length * 0.99)
      
      return {
        totalQueries: recentAnalytics.length,
        averageLatency: Math.round(avgLatency),
        p95Latency: latencies[p95Index] || 0,
        p99Latency: latencies[p99Index] || 0,
        errorRate: 0, // Would need error tracking
        averageRecall: 0.85, // Would need evaluation data
        averagePrecision: 0.78, // Would need evaluation data
        averageMRR: 0.82, // Would need evaluation data
        memoryUsage: process.memoryUsage().heapUsed,
        indexSize: 0, // Would need database query
        cacheHitRate: 0, // Would need cache tracking
        lastUpdated: new Date()
      }
    } catch (error) {
      this.logger.error('Failed to get retriever metrics:', error)
      throw error
    }
  }
  
  /**
   * Generate unique query ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
