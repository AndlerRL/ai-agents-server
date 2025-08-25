/**
 * Memory Store Implementation
 * Provides flexible memory storage with multiple backends
 * Supports embeddings, semantic search, and intelligent chunking
 */

import { nanoid } from 'nanoid'
import type { 
  MemoryStore, 
  MemoryEntry, 
  MemoryMetadata, 
  ChunkingConfig, 
  Chunk, 
  ChunkMetadata 
} from './types'

// ============================================================================
// In-Memory Store Implementation
// ============================================================================

export class InMemoryStore implements MemoryStore {
  private entries = new Map<string, MemoryEntry>()
  private ttlTimers = new Map<string, Timer>()

  async store(key: string, value: MemoryEntry): Promise<void> {
    // Clear existing TTL timer
    const existingTimer = this.ttlTimers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Store the entry
    this.entries.set(key, { ...value, id: key })

    // Set TTL timer if specified
    if (value.ttl && value.ttl > 0) {
      const timer = setTimeout(() => {
        this.delete(key)
      }, value.ttl * 1000)
      
      this.ttlTimers.set(key, timer)
    }
  }

  async retrieve(key: string): Promise<MemoryEntry | null> {
    return this.entries.get(key) || null
  }

  async search(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    const entries = Array.from(this.entries.values())
    
    // Simple text-based search (can be enhanced with embeddings)
    const scored = entries
      .map(entry => ({
        entry,
        score: this.calculateTextSimilarity(query, entry.content)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored.map(item => item.entry)
  }

  async delete(key: string): Promise<boolean> {
    // Clear TTL timer
    const timer = this.ttlTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.ttlTimers.delete(key)
    }

    return this.entries.delete(key)
  }

  async clear(): Promise<void> {
    // Clear all TTL timers
    for (const timer of this.ttlTimers.values()) {
      clearTimeout(timer)
    }
    
    this.entries.clear()
    this.ttlTimers.clear()
  }

  // Additional methods for in-memory store
  size(): number {
    return this.entries.size
  }

  keys(): string[] {
    return Array.from(this.entries.keys())
  }

  values(): MemoryEntry[] {
    return Array.from(this.entries.values())
  }

  private calculateTextSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/)
    const contentWords = content.toLowerCase().split(/\s+/)
    
    let matches = 0
    for (const word of queryWords) {
      if (contentWords.some(cWord => cWord.includes(word))) {
        matches++
      }
    }
    
    return matches / queryWords.length
  }
}

// ============================================================================
// Document Chunking Strategies
// ============================================================================

export class DocumentChunker {
  /**
   * Chunk text using the specified strategy
   */
  static chunk(text: string, config: ChunkingConfig): Chunk[] {
    switch (config.strategy) {
      case 'fixed':
        return this.fixedSizeChunking(text, config)
      case 'semantic':
        return this.semanticChunking(text, config)
      case 'sliding':
        return this.slidingWindowChunking(text, config)
      case 'custom':
        if (config.customStrategy) {
          return config.customStrategy(text, config)
        }
        throw new Error('Custom strategy function not provided')
      default:
        return this.fixedSizeChunking(text, config)
    }
  }

  /**
   * Fixed-size chunking strategy
   */
  private static fixedSizeChunking(text: string, config: ChunkingConfig): Chunk[] {
    const chunks: Chunk[] = []
    const words = text.split(/\s+/)
    const wordsPerChunk = Math.floor(config.chunkSize / 5) // Rough estimate: 5 chars per word
    
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunkWords = words.slice(i, i + wordsPerChunk)
      const content = chunkWords.join(' ')
      const startOffset = text.indexOf(chunkWords[0])
      const endOffset = startOffset + content.length
      
      chunks.push({
        id: nanoid(),
        content,
        metadata: {
          source: 'document',
          index: chunks.length,
          totalChunks: Math.ceil(words.length / wordsPerChunk),
          startOffset,
          endOffset
        }
      })
    }
    
    return chunks
  }

  /**
   * Semantic chunking strategy (sentence-based)
   */
  private static semanticChunking(text: string, config: ChunkingConfig): Chunk[] {
    const chunks: Chunk[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    let currentChunk = ''
    let currentLength = 0
    let chunkIndex = 0
    
    for (const sentence of sentences) {
      const sentenceLength = sentence.trim().length
      
      if (currentLength + sentenceLength > config.chunkSize && currentChunk) {
        // Create chunk
        chunks.push({
          id: nanoid(),
          content: currentChunk.trim(),
          metadata: {
            source: 'document',
            index: chunkIndex++,
            totalChunks: 0, // Will be updated later
            startOffset: text.indexOf(currentChunk.trim()),
            endOffset: text.indexOf(currentChunk.trim()) + currentChunk.trim().length
          }
        })
        
        currentChunk = sentence.trim()
        currentLength = sentenceLength
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence.trim()
        currentLength += sentenceLength
      }
    }
    
    // Add remaining chunk
    if (currentChunk) {
      chunks.push({
        id: nanoid(),
        content: currentChunk.trim(),
        metadata: {
          source: 'document',
          index: chunkIndex,
          totalChunks: 0,
          startOffset: text.indexOf(currentChunk.trim()),
          endOffset: text.indexOf(currentChunk.trim()) + currentChunk.trim().length
        }
      })
    }
    
    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length
    })
    
    return chunks
  }

  /**
   * Sliding window chunking strategy
   */
  private static slidingWindowChunking(text: string, config: ChunkingConfig): Chunk[] {
    const chunks: Chunk[] = []
    const words = text.split(/\s+/)
    const wordsPerChunk = Math.floor(config.chunkSize / 5)
    const overlapWords = Math.floor(config.overlap / 5)
    const step = wordsPerChunk - overlapWords
    
    for (let i = 0; i < words.length; i += step) {
      const chunkWords = words.slice(i, i + wordsPerChunk)
      if (chunkWords.length === 0) break
      
      const content = chunkWords.join(' ')
      const startOffset = text.indexOf(chunkWords[0], i > 0 ? chunks[chunks.length - 1]?.metadata.startOffset || 0 : 0)
      const endOffset = startOffset + content.length
      
      chunks.push({
        id: nanoid(),
        content,
        metadata: {
          source: 'document',
          index: chunks.length,
          totalChunks: Math.ceil(words.length / step),
          startOffset,
          endOffset
        }
      })
      
      // Break if we've covered all words
      if (i + wordsPerChunk >= words.length) break
    }
    
    return chunks
  }
}

// ============================================================================
// Enhanced Memory Store with Chunking Support
// ============================================================================

export class EnhancedMemoryStore implements MemoryStore {
  private baseStore: MemoryStore
  private chunkingConfig: ChunkingConfig
  private documentChunks = new Map<string, string[]>() // document ID -> chunk IDs

  constructor(
    baseStore: MemoryStore, 
    chunkingConfig: ChunkingConfig
  ) {
    this.baseStore = baseStore
    this.chunkingConfig = chunkingConfig
  }

  async store(key: string, value: MemoryEntry): Promise<void> {
    // If it's a large document, chunk it
    if (value.content.length > this.chunkingConfig.chunkSize) {
      await this.storeDocument(key, value)
    } else {
      await this.baseStore.store(key, value)
    }
  }

  async retrieve(key: string): Promise<MemoryEntry | null> {
    return this.baseStore.retrieve(key)
  }

  async search(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    return this.baseStore.search(query, limit)
  }

  async delete(key: string): Promise<boolean> {
    // Check if this is a document with chunks
    const chunkIds = this.documentChunks.get(key)
    if (chunkIds) {
      // Delete all chunks
      await Promise.all(chunkIds.map(chunkId => this.baseStore.delete(chunkId)))
      this.documentChunks.delete(key)
    }
    
    return this.baseStore.delete(key)
  }

  async clear(): Promise<void> {
    this.documentChunks.clear()
    return this.baseStore.clear()
  }

  /**
   * Store a large document by chunking it
   */
  private async storeDocument(key: string, value: MemoryEntry): Promise<void> {
    const chunks = DocumentChunker.chunk(value.content, this.chunkingConfig)
    const chunkIds: string[] = []

    // Store each chunk
    for (const chunk of chunks) {
      const chunkKey = `${key}_chunk_${chunk.metadata.index}`
      const chunkEntry: MemoryEntry = {
        id: chunkKey,
        content: chunk.content,
        metadata: {
          ...value.metadata,
          type: 'document',
          context: {
            ...value.metadata.context,
            parentDocument: key,
            chunkIndex: chunk.metadata.index,
            totalChunks: chunk.metadata.totalChunks
          }
        },
        embedding: chunk.embedding,
        timestamp: value.timestamp,
        ttl: value.ttl
      }

      await this.baseStore.store(chunkKey, chunkEntry)
      chunkIds.push(chunkKey)
    }

    // Store document metadata
    const documentMetadata: MemoryEntry = {
      id: key,
      content: `Document with ${chunks.length} chunks`,
      metadata: {
        ...value.metadata,
        type: 'document',
        context: {
          ...value.metadata.context,
          isChunked: true,
          chunkCount: chunks.length,
          originalSize: value.content.length
        }
      },
      timestamp: value.timestamp,
      ttl: value.ttl
    }

    await this.baseStore.store(key, documentMetadata)
    this.documentChunks.set(key, chunkIds)
  }

  /**
   * Reconstruct a document from its chunks
   */
  async reconstructDocument(documentKey: string): Promise<string | null> {
    const chunkIds = this.documentChunks.get(documentKey)
    if (!chunkIds) return null

    const chunks = await Promise.all(
      chunkIds.map(id => this.baseStore.retrieve(id))
    )

    return chunks
      .filter((chunk): chunk is MemoryEntry => chunk !== null)
      .sort((a, b) => {
        const aIndex = (a.metadata.context?.chunkIndex as number) || 0
        const bIndex = (b.metadata.context?.chunkIndex as number) || 0
        return aIndex - bIndex
      })
      .map(chunk => chunk.content)
      .join(' ')
  }

  /**
   * Get document chunks
   */
  async getDocumentChunks(documentKey: string): Promise<MemoryEntry[]> {
    const chunkIds = this.documentChunks.get(documentKey)
    if (!chunkIds) return []

    const chunks = await Promise.all(
      chunkIds.map(id => this.baseStore.retrieve(id))
    )

    return chunks.filter((chunk): chunk is MemoryEntry => chunk !== null)
  }

  /**
   * Update chunking configuration
   */
  updateChunkingConfig(config: Partial<ChunkingConfig>): void {
    this.chunkingConfig = { ...this.chunkingConfig, ...config }
  }

  /**
   * Get chunking statistics
   */
  getChunkingStats(): {
    totalDocuments: number
    totalChunks: number
    averageChunksPerDocument: number
  } {
    const totalDocuments = this.documentChunks.size
    const totalChunks = Array.from(this.documentChunks.values())
      .reduce((sum, chunks) => sum + chunks.length, 0)
    
    return {
      totalDocuments,
      totalChunks,
      averageChunksPerDocument: totalDocuments > 0 ? totalChunks / totalDocuments : 0
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMemoryStore(
  type: 'memory' | 'enhanced' = 'memory',
  chunkingConfig?: ChunkingConfig
): MemoryStore {
  const baseStore = new InMemoryStore()
  
  if (type === 'enhanced' && chunkingConfig) {
    return new EnhancedMemoryStore(baseStore, chunkingConfig)
  }
  
  return baseStore
}

export function createDefaultChunkingConfig(): ChunkingConfig {
  return {
    strategy: 'semantic',
    chunkSize: 1000,
    overlap: 200
  }
}
