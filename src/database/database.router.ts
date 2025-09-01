import { getDatabaseConnection } from './connection'
import type { Neo4jService } from './services/neo4j.service'

// Get the database type from the connection
type DatabaseConnection = ReturnType<typeof getDatabaseConnection>['db']

export interface QueryContext {
  query: string
  queryType: 'entity_lookup' | 'relationship_traversal' | 'semantic_search' | 'hybrid_search' | 'graph_analytics'
  complexity: 'simple' | 'medium' | 'complex'
  expectedTraversalDepth?: number
  requiresGraphAnalytics?: boolean
  preferredStrategy?: 'vector_similarity' | 'graph_traversal' | 'hybrid'
}

export interface DatabaseRoutingDecision {
  primaryDatabase: 'postgres' | 'neo4j'
  secondaryDatabase?: 'postgres' | 'neo4j'
  useHybridApproach: boolean
  reasoning: string
  estimatedLatencyMs?: number
  schemaToUse: 'public' | 'graph_public'
}

export interface RoutingStrategy {
  name: string
  description: string
  evaluate(context: QueryContext): Promise<DatabaseRoutingDecision>
}

/**
 * Vector-first strategy: Prefer PostgreSQL with pgvector for semantic similarity
 */
export class VectorFirstStrategy implements RoutingStrategy {
  name = 'vector_first'
  description = 'Prioritizes PostgreSQL with pgvector for semantic similarity searches'

  async evaluate(context: QueryContext): Promise<DatabaseRoutingDecision> {
    const useGraph = context.queryType === 'relationship_traversal' || 
                    context.queryType === 'graph_analytics' ||
                    (context.expectedTraversalDepth ?? 0) > 2

    if (useGraph) {
      return {
        primaryDatabase: 'neo4j',
        secondaryDatabase: 'postgres',
        useHybridApproach: true,
        reasoning: 'Complex graph traversal detected, using Neo4j with PostgreSQL fallback',
        schemaToUse: 'graph_public'
      }
    }

    return {
      primaryDatabase: 'postgres',
      useHybridApproach: false,
      reasoning: 'Vector similarity search, using PostgreSQL with pgvector',
      schemaToUse: 'public'
    }
  }
}

/**
 * Graph-first strategy: Prefer Neo4j for relationship-rich queries
 */
export class GraphFirstStrategy implements RoutingStrategy {
  name = 'graph_first'
  description = 'Prioritizes Neo4j for relationship traversal and graph analytics'

  async evaluate(context: QueryContext): Promise<DatabaseRoutingDecision> {
    const useVector = context.queryType === 'semantic_search' && 
                     !context.requiresGraphAnalytics &&
                     (context.expectedTraversalDepth ?? 0) <= 1

    if (useVector) {
      return {
        primaryDatabase: 'postgres',
        secondaryDatabase: 'neo4j',
        useHybridApproach: true,
        reasoning: 'Simple semantic search with potential graph enhancement',
        schemaToUse: 'public'
      }
    }

    return {
      primaryDatabase: 'neo4j',
      useHybridApproach: false,
      reasoning: 'Graph-native query, using Neo4j for optimal performance',
      schemaToUse: 'graph_public'
    }
  }
}

/**
 * Adaptive strategy: Intelligently routes based on query characteristics
 */
export class AdaptiveStrategy implements RoutingStrategy {
  name = 'adaptive'
  description = 'Intelligently routes queries based on characteristics and complexity'

  async evaluate(context: QueryContext): Promise<DatabaseRoutingDecision> {
    // Simple semantic searches go to PostgreSQL
    if (context.queryType === 'semantic_search' && context.complexity === 'simple') {
      return {
        primaryDatabase: 'postgres',
        useHybridApproach: false,
        reasoning: 'Simple semantic search, PostgreSQL optimal for vector similarity',
        estimatedLatencyMs: 50,
        schemaToUse: 'public'
      }
    }

    // Complex graph analytics always go to Neo4j
    if (context.queryType === 'graph_analytics' || context.requiresGraphAnalytics) {
      return {
        primaryDatabase: 'neo4j',
        useHybridApproach: false,
        reasoning: 'Graph analytics required, Neo4j provides native graph operations',
        estimatedLatencyMs: 150,
        schemaToUse: 'graph_public'
      }
    }

    // Relationship traversal decisions based on depth
    if (context.queryType === 'relationship_traversal') {
      const depth = context.expectedTraversalDepth ?? 1
      
      if (depth <= 1) {
        return {
          primaryDatabase: 'postgres',
          secondaryDatabase: 'neo4j',
          useHybridApproach: true,
          reasoning: 'Shallow relationship traversal, hybrid approach for completeness',
          estimatedLatencyMs: 100,
          schemaToUse: 'public'
        }
      }
      
      return {
        primaryDatabase: 'neo4j',
        useHybridApproach: false,
        reasoning: `Deep relationship traversal (depth ${depth}), Neo4j optimal`,
        estimatedLatencyMs: 200,
        schemaToUse: 'graph_public'
      }
    }

    // Hybrid searches use both systems
    if (context.queryType === 'hybrid_search') {
      return {
        primaryDatabase: 'postgres',
        secondaryDatabase: 'neo4j',
        useHybridApproach: true,
        reasoning: 'Hybrid search combining vector similarity and graph relationships',
        estimatedLatencyMs: 250,
        schemaToUse: 'graph_public'
      }
    }

    // Entity lookups prefer PostgreSQL for simplicity
    return {
      primaryDatabase: 'postgres',
      useHybridApproach: false,
      reasoning: 'Entity lookup, PostgreSQL sufficient',
      estimatedLatencyMs: 30,
      schemaToUse: 'public'
    }
  }
}

/**
 * Database router that intelligently chooses between PostgreSQL and Neo4j
 * based on query characteristics and routing strategy
 */
export class DatabaseRouter {
  private strategies: Map<string, RoutingStrategy> = new Map()
  private defaultStrategy: string = 'adaptive'

  constructor(
    private postgres: DatabaseConnection,
    private neo4j: Neo4jService
  ) {
    this.registerStrategy(new VectorFirstStrategy())
    this.registerStrategy(new GraphFirstStrategy())
    this.registerStrategy(new AdaptiveStrategy())
  }

  registerStrategy(strategy: RoutingStrategy): void {
    this.strategies.set(strategy.name, strategy)
  }

  setDefaultStrategy(strategyName: string): void {
    if (!this.strategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' not found`)
    }
    this.defaultStrategy = strategyName
  }

  async route(
    context: QueryContext,
    strategyName?: string
  ): Promise<DatabaseRoutingDecision> {
    const strategy = this.strategies.get(strategyName ?? this.defaultStrategy)
    if (!strategy) {
      throw new Error(`Strategy '${strategyName ?? this.defaultStrategy}' not found`)
    }

    const decision = await strategy.evaluate(context)
    
    // Log routing decision for analytics
    console.log(`Database Routing Decision:`, {
      strategy: strategy.name,
      context,
      decision
    })

    return decision
  }

  /**
   * Get the appropriate database connection based on routing decision
   */
  getConnection(decision: DatabaseRoutingDecision) {
    return {
      primary: decision.primaryDatabase === 'postgres' ? this.postgres : this.neo4j,
      secondary: decision.secondaryDatabase === 'postgres' ? this.postgres : 
                 decision.secondaryDatabase === 'neo4j' ? this.neo4j : undefined
    }
  }

  /**
   * Execute a query using the routed databases
   */
  async executeQuery<T>(
    context: QueryContext,
    queryFn: (
      primary: DatabaseConnection | Neo4jService,
      secondary?: DatabaseConnection | Neo4jService,
      decision?: DatabaseRoutingDecision
    ) => Promise<T>,
    strategyName?: string
  ): Promise<T> {
    const decision = await this.route(context, strategyName)
    const connections = this.getConnection(decision)
    
    try {
      return await queryFn(connections.primary, connections.secondary, decision)
    } catch (error) {
      console.error('Database query execution failed:', error)
      throw error
    }
  }

  /**
   * Get routing statistics for analytics
   */
  getRoutingStats() {
    return {
      availableStrategies: Array.from(this.strategies.keys()),
      defaultStrategy: this.defaultStrategy,
      strategies: Array.from(this.strategies.values()).map(s => ({
        name: s.name,
        description: s.description
      }))
    }
  }
}

/**
 * Query context builder for easier construction of routing contexts
 */
export class QueryContextBuilder {
  private context: Partial<QueryContext> = {}

  query(query: string): this {
    this.context.query = query
    return this
  }

  type(queryType: QueryContext['queryType']): this {
    this.context.queryType = queryType
    return this
  }

  complexity(complexity: QueryContext['complexity']): this {
    this.context.complexity = complexity
    return this
  }

  traversalDepth(depth: number): this {
    this.context.expectedTraversalDepth = depth
    return this
  }

  requiresGraphAnalytics(required = true): this {
    this.context.requiresGraphAnalytics = required
    return this
  }

  preferredStrategy(strategy: QueryContext['preferredStrategy']): this {
    this.context.preferredStrategy = strategy
    return this
  }

  build(): QueryContext {
    if (!this.context.query || !this.context.queryType) {
      throw new Error('Query and queryType are required')
    }

    return {
      complexity: 'medium',
      ...this.context
    } as QueryContext
  }
}

// Helper function for creating query contexts
export const createQueryContext = () => new QueryContextBuilder()
