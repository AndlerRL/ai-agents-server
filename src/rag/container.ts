/**
 * Dependency Injection Container Implementation
 * Provides service registration, resolution, and lifecycle management
 */

import type { 
  ServiceContainer, 
  ServiceToken, 
  ServiceFactory,
  Logger 
} from './interfaces'

// ============================================================================
// Service Registration Types
// ============================================================================

interface ServiceRegistration<T = any> {
  factory: ServiceFactory<T>
  lifecycle: 'transient' | 'singleton' | 'instance'
  instance?: T
  dependencies?: ServiceToken[]
}

// ============================================================================
// Simple Logger Implementation
// ============================================================================

export class ConsoleLogger implements Logger {
  private prefix: string
  
  constructor(prefix = '[RAG]') {
    this.prefix = prefix
  }
  
  debug(message: string, meta?: any): void {
    console.debug(`${this.prefix} DEBUG: ${message}`, meta || '')
  }
  
  info(message: string, meta?: any): void {
    console.info(`${this.prefix} INFO: ${message}`, meta || '')
  }
  
  warn(message: string, meta?: any): void {
    console.warn(`${this.prefix} WARN: ${message}`, meta || '')
  }
  
  error(message: string, meta?: any): void {
    console.error(`${this.prefix} ERROR: ${message}`, meta || '')
  }
}

// ============================================================================
// Dependency Injection Container
// ============================================================================

export class DIContainer implements ServiceContainer {
  private services = new Map<ServiceToken, ServiceRegistration>()
  private instances = new Map<ServiceToken, any>()
  private resolving = new Set<ServiceToken>()
  
  /**
   * Register a transient service (new instance each time)
   */
  register<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.services.set(token, {
      factory,
      lifecycle: 'transient'
    })
  }
  
  /**
   * Register a singleton service (same instance always)
   */
  registerSingleton<T>(token: ServiceToken<T>, factory: ServiceFactory<T>): void {
    this.services.set(token, {
      factory,
      lifecycle: 'singleton'
    })
  }
  
  /**
   * Register a specific instance
   */
  registerInstance<T>(token: ServiceToken<T>, instance: T): void {
    this.services.set(token, {
      factory: () => instance,
      lifecycle: 'instance'
    })
    this.instances.set(token, instance)
  }
  
  /**
   * Resolve a service by token
   */
  resolve<T>(token: ServiceToken<T>): T {
    // Check for circular dependencies
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected while resolving: ${String(token)}`)
    }
    
    const registration = this.services.get(token)
    if (!registration) {
      throw new Error(`Service not registered: ${String(token)}`)
    }
    
    // Return existing instance for singletons
    if (registration.lifecycle === 'singleton') {
      const existingInstance = this.instances.get(token)
      if (existingInstance) {
        return existingInstance
      }
    }
    
    // Return registered instance
    if (registration.lifecycle === 'instance') {
      return registration.instance!
    }
    
    // Create new instance
    this.resolving.add(token)
    
    try {
      const instance = registration.factory(this)
      
      // Cache singleton instances
      if (registration.lifecycle === 'singleton') {
        this.instances.set(token, instance)
      }
      
      return instance as T
    } catch (error) {
      throw new Error(`Failed to resolve service ${String(token)}: ${error}`)
    } finally {
      this.resolving.delete(token)
    }
  }
  
  /**
   * Try to resolve a service, return undefined if not found
   */
  resolveOptional<T>(token: ServiceToken<T>): T | undefined {
    try {
      return this.resolve(token)
    } catch (error) {
      return undefined
    }
  }
  
  /**
   * Check if a service is registered
   */
  isRegistered(token: ServiceToken): boolean {
    return this.services.has(token)
  }
  
  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): ServiceToken[] {
    return Array.from(this.services.keys())
  }
  
  /**
   * Clear all services and instances
   */
  clear(): void {
    this.services.clear()
    this.instances.clear()
    this.resolving.clear()
  }
  
  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    // Dispose instances that have a dispose method
    for (const [token, instance] of this.instances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          await instance.dispose()
        } catch (error) {
          console.error(`Error disposing service ${String(token)}:`, error)
        }
      }
    }
    
    this.clear()
  }
}

// ============================================================================
// Service Registration Helpers
// ============================================================================

export class ServiceRegistrar {
  constructor(private container: ServiceContainer) {}
  
  /**
   * Register all core RAG services
   */
  registerCoreServices(): void {
    // Register logger first (no dependencies)
    this.container.registerSingleton(
      Symbol('Logger'),
      () => new ConsoleLogger('[RAG]')
    )
    
    // Register configuration (loaded from environment/file)
    this.container.registerSingleton(
      Symbol('RagSystemConfig'),
      () => this.loadConfiguration()
    )
  }
  
  /**
   * Register embedding providers
   */
  registerEmbeddingProviders(): void {
    // Will be implemented with specific providers
  }
  
  /**
   * Register all retriever implementations
   */
  registerRetrievers(): void {
    // Will be implemented with specific retrievers
  }
  
  /**
   * Register processing services
   */
  registerProcessingServices(): void {
    // Will be implemented with specific processors
  }
  
  /**
   * Register analytics and monitoring services
   */
  registerAnalyticsServices(): void {
    // Will be implemented with specific analytics
  }
  
  /**
   * Load configuration from environment variables or config files
   */
  private loadConfiguration(): any {
    return {
      embedding: {
        provider: process.env.RAG_EMBEDDING_PROVIDER || 'huggingface',
        model: process.env.RAG_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
        dimensions: parseInt(process.env.RAG_EMBEDDING_DIMENSIONS || '384'),
        batchSize: parseInt(process.env.RAG_EMBEDDING_BATCH_SIZE || '10'),
        maxRetries: parseInt(process.env.RAG_EMBEDDING_MAX_RETRIES || '3')
      },
      
      database: {
        maxConnections: parseInt(process.env.RAG_DB_MAX_CONNECTIONS || '10'),
        queryTimeout: parseInt(process.env.RAG_DB_QUERY_TIMEOUT || '30000'),
        indexType: process.env.RAG_DB_INDEX_TYPE || 'hnsw',
        indexParameters: {
          m: parseInt(process.env.RAG_HNSW_M || '16'),
          efConstruction: parseInt(process.env.RAG_HNSW_EF_CONSTRUCTION || '200')
        }
      },
      
      retrieval: {
        defaultStrategy: (process.env.RAG_DEFAULT_STRATEGY || 'adaptive') as any,
        defaultTopK: parseInt(process.env.RAG_DEFAULT_TOP_K || '5'),
        scoreThreshold: parseFloat(process.env.RAG_SCORE_THRESHOLD || '0.5'),
        maxContextLength: parseInt(process.env.RAG_MAX_CONTEXT_LENGTH || '4000')
      },
      
      processing: {
        chunkingStrategy: {
          name: 'adaptive',
          coarseSize: parseInt(process.env.RAG_COARSE_CHUNK_SIZE || '1000'),
          fineSize: parseInt(process.env.RAG_FINE_CHUNK_SIZE || '200'),
          overlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '50'),
          method: 'semantic'
        },
        supportedFormats: ['txt', 'md', 'pdf', 'docx', 'html'],
        maxDocumentSize: parseInt(process.env.RAG_MAX_DOC_SIZE || '10485760'), // 10MB
        parallelProcessing: process.env.RAG_PARALLEL_PROCESSING !== 'false'
      },
      
      performance: {
        cacheSize: parseInt(process.env.RAG_CACHE_SIZE || '1000'),
        cacheTimeout: parseInt(process.env.RAG_CACHE_TIMEOUT || '3600000'), // 1 hour
        enableMetrics: process.env.RAG_ENABLE_METRICS !== 'false',
        metricsRetention: parseInt(process.env.RAG_METRICS_RETENTION || '604800000') // 7 days
      },
      
      security: {
        enablePIIDetection: process.env.RAG_ENABLE_PII_DETECTION === 'true',
        encryptMetadata: process.env.RAG_ENCRYPT_METADATA === 'true',
        accessControl: process.env.RAG_ACCESS_CONTROL === 'true',
        auditLogging: process.env.RAG_AUDIT_LOGGING === 'true'
      }
    }
  }
}

// ============================================================================
// Container Factory and Bootstrap
// ============================================================================

export class ContainerFactory {
  /**
   * Create and configure a new DI container with all RAG services
   */
  static async createContainer(): Promise<ServiceContainer> {
    const container = new DIContainer()
    const registrar = new ServiceRegistrar(container)
    
    // Register services in dependency order
    registrar.registerCoreServices()
    registrar.registerEmbeddingProviders()
    registrar.registerProcessingServices()
    registrar.registerRetrievers()
    registrar.registerAnalyticsServices()
    
    return container
  }
  
  /**
   * Create a container with minimal services for testing
   */
  static createTestContainer(): ServiceContainer {
    const container = new DIContainer()
    
    // Register minimal services for testing
    container.registerInstance(Symbol('Logger'), new ConsoleLogger('[TEST]'))
    container.registerInstance(Symbol('RagSystemConfig'), {
      // Minimal test config
      embedding: { provider: 'test', model: 'test', dimensions: 384, batchSize: 1, maxRetries: 1 },
      database: { maxConnections: 1, queryTimeout: 5000, indexType: 'hnsw', indexParameters: {} },
      retrieval: { defaultStrategy: 'retrieve_read', defaultTopK: 3, scoreThreshold: 0.5, maxContextLength: 1000 }
    })
    
    return container
  }
}

// ============================================================================
// Service Lifecycle Management
// ============================================================================

export class ServiceLifecycleManager {
  private container: ServiceContainer
  private startupOrder: ServiceToken[] = []
  private shutdownOrder: ServiceToken[] = []
  
  constructor(container: ServiceContainer) {
    this.container = container
  }
  
  /**
   * Define the order services should be started
   */
  setStartupOrder(tokens: ServiceToken[]): void {
    this.startupOrder = [...tokens]
  }
  
  /**
   * Define the order services should be shut down
   */
  setShutdownOrder(tokens: ServiceToken[]): void {
    this.shutdownOrder = [...tokens]
  }
  
  /**
   * Start all services in the defined order
   */
  async startup(): Promise<void> {
    for (const token of this.startupOrder) {
      try {
        const service = this.container.resolve(token)
        
        if (service && typeof service.start === 'function') {
          await service.start()
        }
      } catch (error) {
        throw new Error(`Failed to start service ${String(token)}: ${error}`)
      }
    }
  }
  
  /**
   * Shutdown all services in the defined order
   */
  async shutdown(): Promise<void> {
    for (const token of this.shutdownOrder) {
      try {
        const service = this.container.resolveOptional(token)
        
        if (service && typeof service.stop === 'function') {
          await service.stop()
        }
      } catch (error) {
        console.error(`Error stopping service ${String(token)}:`, error)
      }
    }
    
    await this.container.dispose()
  }
}

// ============================================================================
// Service Registration Helpers (Manual Pattern)
// ============================================================================

/**
 * Simple service registration pattern without decorators
 * Services can implement this interface for standardized registration
 */
export interface ServiceDefinition {
  token: ServiceToken
  factory: ServiceFactory<any>
  lifecycle: 'transient' | 'singleton' | 'instance'
  dependencies?: ServiceToken[]
}

/**
 * Helper to create service definitions
 */
export function defineService<T>(
  token: ServiceToken<T>,
  factory: ServiceFactory<T>,
  lifecycle: 'transient' | 'singleton' | 'instance' = 'singleton'
): ServiceDefinition {
  return { token, factory, lifecycle }
}

/**
 * Auto-register multiple services
 */
export function registerServices(
  container: ServiceContainer,
  definitions: ServiceDefinition[]
): void {
  for (const def of definitions) {
    switch (def.lifecycle) {
      case 'transient':
        container.register(def.token, def.factory)
        break
      case 'singleton':
        container.registerSingleton(def.token, def.factory)
        break
      case 'instance':
        container.registerInstance(def.token, def.factory(container))
        break
    }
  }
}
