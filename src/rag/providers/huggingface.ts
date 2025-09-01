/**
 * HuggingFace Embedding Provider Implementation
 * Supports multiple HF models for text embeddings
 */

import { HfInference } from '@huggingface/inference'
import { BaseEmbeddingProvider } from '../interfaces'
import type { Logger } from '../interfaces'

// ============================================================================
// HuggingFace Provider Configuration
// ============================================================================

export interface HuggingFaceConfig {
  apiKey?: string
  model: string
  maxRetries: number
  timeout: number
  batchSize: number
  useLocalModel?: boolean
  localModelPath?: string
}

// ============================================================================
// Supported Models Configuration:
// I may add more models here in the future, for now these are for tests to use with different RAG systems
// ============================================================================

export const HUGGINGFACE_MODELS = {
  // Sentence Transformers (optimized for semantic similarity)
  'all-MiniLM-L6-v2': {
    name: 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
    maxTokens: 256,
    description: 'Fast and efficient, good for general use',
    costPerToken: 0.0001
  },
  
  'all-mpnet-base-v2': {
    name: 'sentence-transformers/all-mpnet-base-v2',
    dimensions: 768,
    maxTokens: 384,
    description: 'Higher quality, slower inference',
    costPerToken: 0.0002
  },
  
  'multi-qa-MiniLM-L6-cos-v1': {
    name: 'sentence-transformers/multi-qa-MiniLM-L6-cos-v1',
    dimensions: 384,
    maxTokens: 512,
    description: 'Optimized for question-answering',
    costPerToken: 0.0001
  },
  
  // Instructor models (support query/document instructions)
  'instructor-xl': {
    name: 'hkunlp/instructor-xl',
    dimensions: 768,
    maxTokens: 512,
    description: 'Instruction-tuned for diverse tasks',
    costPerToken: 0.0003
  },
  
  // BGE models (high performance Chinese/English)
  'bge-large-en': {
    name: 'BAAI/bge-large-en-v1.5',
    dimensions: 1024,
    maxTokens: 512,
    description: 'High performance English embeddings',
    costPerToken: 0.0004
  },
  
  // E5 models (state-of-the-art performance)
  'e5-large-v2': {
    name: 'intfloat/e5-large-v2',
    dimensions: 1024,
    maxTokens: 512,
    description: 'State-of-the-art performance',
    costPerToken: 0.0005
  }
} as const

export type SupportedModel = keyof typeof HUGGINGFACE_MODELS

// ============================================================================
// HuggingFace Embedding Provider
// ============================================================================

export class HuggingFaceEmbeddingProvider extends BaseEmbeddingProvider {
  name = 'huggingface'
  model: string
  dimensions: number
  maxTokens: number
  costPerToken?: number
  
  private hf: HfInference
  private config: HuggingFaceConfig
  private modelInfo: typeof HUGGINGFACE_MODELS[SupportedModel]
  
  constructor(config: HuggingFaceConfig, logger: Logger) {
    super(logger)
    
    this.config = config
    this.model = config.model
    
    // Get model information
    const modelKey = this.findModelKey(config.model)
    if (!modelKey) {
      throw new Error(`Unsupported HuggingFace model: ${config.model}`)
    }
    
    this.modelInfo = HUGGINGFACE_MODELS[modelKey]
    this.dimensions = this.modelInfo.dimensions
    this.maxTokens = this.modelInfo.maxTokens
    this.costPerToken = this.modelInfo.costPerToken
    
    // Initialize HuggingFace client
    this.hf = new HfInference(config.apiKey || process.env.HUGGINGFACE_API_KEY)
    
    this.logger.info(`Initialized HuggingFace provider with model: ${this.model}`)
  }
  
  /**
   * Find model key from full model name or short name
   */
  private findModelKey(modelName: string): SupportedModel | null {
    // Direct match by key
    if (modelName in HUGGINGFACE_MODELS) {
      return modelName as SupportedModel
    }
    
    // Match by full model name
    for (const [key, info] of Object.entries(HUGGINGFACE_MODELS)) {
      if (info.name === modelName) {
        return key as SupportedModel
      }
    }
    
    return null
  }
  
  /**
   * Generate single embedding with retry logic
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (text.length === 0) {
      throw new Error('Cannot generate embedding for empty text')
    }
    
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now()
        
        const response = await this.hf.featureExtraction({
          model: this.modelInfo.name,
          inputs: this.preprocessText(text)
        })
        
        const embedding = this.extractEmbedding(response)
        const latency = Date.now() - startTime
        
        this.logger.debug(`Generated embedding in ${latency}ms (attempt ${attempt})`)
        
        return embedding
        
      } catch (error) {
        lastError = error as Error
        this.logger.warn(`Embedding attempt ${attempt} failed:`, error)
        
        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await this.sleep(delay)
        }
      }
    }
    
    throw new Error(`Failed to generate embedding after ${this.config.maxRetries} attempts: ${lastError?.message}`)
  }
  
  /**
   * Generate multiple embeddings in batches
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }
    
    const results: number[][] = []
    
    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize)
      const batchResults = await this.generateBatch(batch)
      results.push(...batchResults)
    }
    
    return results
  }
  
  /**
   * Generate embeddings for a batch of texts
   */
  private async generateBatch(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const startTime = Date.now()
        
        const preprocessedTexts = texts.map(text => this.preprocessText(text))
        
        const response = await this.hf.featureExtraction({
          model: this.modelInfo.name,
          inputs: preprocessedTexts
        })
        
        const embeddings = this.extractBatchEmbeddings(response, texts.length)
        const latency = Date.now() - startTime
        
        this.logger.debug(`Generated ${texts.length} embeddings in ${latency}ms (attempt ${attempt})`)
        
        return embeddings
        
      } catch (error) {
        lastError = error as Error
        this.logger.warn(`Batch embedding attempt ${attempt} failed:`, error)
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await this.sleep(delay)
        }
      }
    }
    
    // Fallback to individual requests
    this.logger.warn('Batch embedding failed, falling back to individual requests')
    return Promise.all(texts.map(text => this.generateEmbedding(text)))
  }
  
  /**
   * Generate query-specific embedding (for instruction-tuned models)
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    // Add query instruction for supported models
    const instructedQuery = this.addQueryInstruction(query)
    return this.generateEmbedding(instructedQuery)
  }
  
  /**
   * Generate document-specific embedding (for instruction-tuned models)
   */
  async generateDocumentEmbedding(document: string): Promise<number[]> {
    // Add document instruction for supported models
    const instructedDocument = this.addDocumentInstruction(document)
    return this.generateEmbedding(instructedDocument)
  }
  
  /**
   * Preprocess text before embedding
   */
  private preprocessText(text: string): string {
    // Truncate to max tokens (approximate)
    const maxChars = this.maxTokens * 4 // rough approximation
    if (text.length > maxChars) {
      text = text.substring(0, maxChars)
      this.logger.warn(`Text truncated to ${maxChars} characters`)
    }
    
    // Clean whitespace
    return text.trim().replace(/\s+/g, ' ')
  }
  
  /**
   * Add query instruction for instruction-tuned models
   */
  private addQueryInstruction(query: string): string {
    if (this.model.includes('instructor')) {
      return `Represent the question for retrieving supporting documents: ${query}`
    }
    
    if (this.model.includes('e5')) {
      return `query: ${query}`
    }
    
    return query
  }
  
  /**
   * Add document instruction for instruction-tuned models
   */
  private addDocumentInstruction(document: string): string {
    if (this.model.includes('instructor')) {
      return `Represent the document for retrieval: ${document}`
    }
    
    if (this.model.includes('e5')) {
      return `passage: ${document}`
    }
    
    return document
  }
  
  /**
   * Extract embedding from HuggingFace response
   */
  private extractEmbedding(response: any): number[] {
    if (Array.isArray(response)) {
      if (Array.isArray(response[0])) {
        // 2D array - take first row
        return response[0]
      }
      // 1D array
      return response
    }
    
    throw new Error('Invalid embedding response format')
  }
  
  /**
   * Extract batch embeddings from HuggingFace response
   */
  private extractBatchEmbeddings(response: any, expectedCount: number): number[][] {
    if (!Array.isArray(response)) {
      throw new Error('Invalid batch embedding response format')
    }
    
    // Handle different response formats
    if (response.length === expectedCount && Array.isArray(response[0])) {
      return response as number[][]
    }
    
    throw new Error(`Expected ${expectedCount} embeddings, got ${response.length}`)
  }
  
  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: this.name,
      model: this.model,
      modelInfo: this.modelInfo,
      dimensions: this.dimensions,
      maxTokens: this.maxTokens,
      costPerToken: this.costPerToken,
      supportsInstructions: this.model.includes('instructor') || this.model.includes('e5')
    }
  }
  
  /**
   * Health check - verify API access
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.generateEmbedding('health check')
      return true
    } catch (error) {
      this.logger.error('HuggingFace embedding provider health check failed:', error)
      return false
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createHuggingFaceProvider(
  modelName: string,
  options: Partial<HuggingFaceConfig> = {},
  logger: Logger
): HuggingFaceEmbeddingProvider {
  const config: HuggingFaceConfig = {
    model: modelName,
    maxRetries: 3,
    timeout: 30000,
    batchSize: 10,
    ...options
  }
  
  return new HuggingFaceEmbeddingProvider(config, logger)
}

// ============================================================================
// Model Selection Utilities
// ============================================================================

export function selectOptimalModel(requirements: {
  speed?: 'fast' | 'medium' | 'slow'
  quality?: 'good' | 'better' | 'best'
  language?: 'english' | 'multilingual' | 'chinese'
  useCase?: 'general' | 'qa' | 'similarity' | 'classification'
}): SupportedModel {
  const { speed = 'medium', quality = 'better', language = 'english', useCase = 'general' } = requirements
  
  // QA-specific models
  if (useCase === 'qa') {
    return 'multi-qa-MiniLM-L6-cos-v1'
  }
  
  // High-quality models
  if (quality === 'best') {
    return 'e5-large-v2'
  }
  
  // Fast models
  if (speed === 'fast') {
    return 'all-MiniLM-L6-v2'
  }
  
  // Chinese language
  if (language === 'chinese') {
    return 'bge-large-en'
  }
  
  // Balanced choice
  return 'all-mpnet-base-v2'
}

export function getModelRecommendations(): Array<{
  model: SupportedModel
  useCase: string
  pros: string[]
  cons: string[]
}> {
  return [
    {
      model: 'all-MiniLM-L6-v2',
      useCase: 'General purpose, high-speed applications',
      pros: ['Very fast', 'Low memory usage', 'Good quality'],
      cons: ['Lower dimension', 'Less nuanced understanding']
    },
    {
      model: 'all-mpnet-base-v2',
      useCase: 'Balanced performance and quality',
      pros: ['Good quality', 'Reasonable speed', 'Widely tested'],
      cons: ['Higher memory usage than MiniLM']
    },
    {
      model: 'e5-large-v2',
      useCase: 'Highest quality requirements',
      pros: ['State-of-the-art performance', 'Large context window'],
      cons: ['Slower inference', 'Higher cost']
    },
    {
      model: 'instructor-xl',
      useCase: 'Task-specific optimization',
      pros: ['Instruction-tuned', 'Flexible for different tasks'],
      cons: ['Requires task instructions', 'Complex to use']
    }
  ]
}
