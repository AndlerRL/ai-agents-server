import neo4j, { Driver, Session, Record } from 'neo4j-driver'
import type { 
  Neo4jDocument, 
  Neo4jChunk, 
  Neo4jEntity, 
  Neo4jRelationship,
} from '../neo4j.schema'

export interface Neo4jConfig {
  uri: string
  username: string
  password: string
  database?: string
  maxConnectionPoolSize?: number
  connectionTimeout?: number
}

export interface Neo4jHealthCheck {
  healthy: boolean
  latency: number
  nodeCount?: number
  relationshipCount?: number
  error?: string
}

export interface GraphTraversalOptions {
  maxDepth?: number
  relationshipTypes?: string[]
  nodeLabels?: string[]
  limit?: number
  includeProperties?: boolean
}

export interface GraphAnalyticsOptions {
  algorithm: 'pagerank' | 'centrality' | 'community_detection' | 'shortest_path'
  parameters?: { [key: string]: any }
  limit?: number
}

export interface GraphQueryResult {
  query: string
  parameters: { [key: string]: any }
  resultCount: number
  executionTimeMs: number
  paths: any[]
  nodes: any[]
  relationships: any[]
  metadata: { [key: string]: any }
}

/**
 * Neo4j service for graph database operations
 * Handles connections, queries, and data synchronization with PostgreSQL
 */
export class Neo4jService {
  private driver: Driver | null = null
  private defaultDatabase: string

  constructor(private config: Neo4jConfig) {
    this.defaultDatabase = config.database || 'neo4j'
  }

  /**
   * Initialize Neo4j connection
   */
  async connect(): Promise<void> {
    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize || 50,
          connectionTimeout: this.config.connectionTimeout || 30000,
        }
      )

      // Verify connectivity
      await this.driver.verifyConnectivity()
      console.log('Neo4j connection established successfully')
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error)
      throw error
    }
  }

  /**
   * Close Neo4j connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close()
      this.driver = null
      console.log('Neo4j connection closed')
    }
  }

  /**
   * Get a new session for executing queries
   */
  private getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.')
    }
    return this.driver.session({ database: this.defaultDatabase })
  }

  /**
   * Execute a Cypher query
   */
  async executeCypher<T = any>(
    cypher: string, 
    parameters: { [key: string]: any } = {}
  ): Promise<T[]> {
    const session = this.getSession()
    try {
      const result = await session.run(cypher, parameters)
      return result.records.map(record => this.recordToObject(record))
    } finally {
      await session.close()
    }
  }

  /**
   * Convert Neo4j record to plain object
   */
  private recordToObject(record: Record): any {
    const obj: any = {}
    record.keys.forEach(key => {
      const value = record.get(key)
      obj[key] = this.neo4jValueToJs(value)
    })
    return obj
  }

  /**
   * Convert Neo4j values to JavaScript values
   */
  private neo4jValueToJs(value: any): any {
    if (value && typeof value === 'object') {
      if (value.constructor.name === 'Node') {
        return {
          id: value.identity.toString(),
          labels: value.labels,
          properties: value.properties
        }
      }
      if (value.constructor.name === 'Relationship') {
        return {
          id: value.identity.toString(),
          type: value.type,
          startNode: value.start.toString(),
          endNode: value.end.toString(),
          properties: value.properties
        }
      }
      if (value.constructor.name === 'Path') {
        return {
          start: this.neo4jValueToJs(value.start),
          end: this.neo4jValueToJs(value.end),
          segments: value.segments.map((segment: any) => ({
            start: this.neo4jValueToJs(segment.start),
            relationship: this.neo4jValueToJs(segment.relationship),
            end: this.neo4jValueToJs(segment.end)
          })),
          length: value.length
        }
      }
      if (Array.isArray(value)) {
        return value.map(item => this.neo4jValueToJs(item))
      }
    }
    return value
  }

  // ============================================================================
  // Document Operations
  // ============================================================================

  /**
   * Create or update a document node
   */
  async upsertDocument(document: Neo4jDocument): Promise<string> {
    const cypher = `
      MERGE (d:Document {id: $id})
      SET d += $properties
      SET d.lastUpdated = datetime()
      RETURN d.id as nodeId
    `
    
    const result = await this.executeCypher(cypher, {
      id: document.id,
      properties: {
        title: document.title,
        content: document.content,
        contentHash: document.contentHash,
        source: document.source,
        metadata: document.metadata,
        createdAt: document.createdAt?.toISOString(),
        updatedAt: document.updatedAt?.toISOString()
      }
    })

    return result[0]?.nodeId || document.id
  }

  /**
   * Create or update a chunk node and link to document
   */
  async upsertChunk(chunk: Neo4jChunk, documentId: string): Promise<string> {
    const cypher = `
      MATCH (d:Document {id: $documentId})
      MERGE (c:Chunk {id: $id})
      SET c += $properties
      SET c.lastUpdated = datetime()
      MERGE (d)-[:CONTAINS]->(c)
      RETURN c.id as nodeId
    `
    
    const result = await this.executeCypher(cypher, {
      id: chunk.id,
      documentId,
      properties: {
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        embedding: chunk.embedding,
        metadata: chunk.metadata,
        createdAt: chunk.createdAt?.toISOString()
      }
    })

    return result[0]?.nodeId || chunk.id
  }

  // ============================================================================
  // Entity Operations
  // ============================================================================

  /**
   * Create or update an entity node
   */
  async upsertEntity(entity: Neo4jEntity): Promise<string> {
    const cypher = `
      MERGE (e:Entity {id: $id})
      SET e += $properties
      SET e.lastUpdated = datetime()
      RETURN e.id as nodeId
    `
    
    const result = await this.executeCypher(cypher, {
      id: entity.entityId,
      properties: {
        name: entity.entityName,
        entityType: entity.entityType,
        metadata: entity.metadata,
        embedding: entity.embedding,
        createdAt: entity.createdAt?.toISOString()
      }
    })

    return result[0]?.nodeId || entity.entityId
  }

  /**
   * Create or update a relationship
   */
  async upsertRelationship(relationship: Neo4jRelationship): Promise<string> {
    const cypher = `
      MATCH (source {id: $sourceId})
      MATCH (target {id: $targetId})
      MERGE (source)-[r:\`${relationship.type}\`]->(target)
      SET r += $properties
      SET r.lastUpdated = datetime()
      RETURN elementId(r) as relationshipId
    `
    
    const result = await this.executeCypher(cypher, {
      sourceId: relationship.startNodeId,
      targetId: relationship.endNodeId,
      properties: {
        strength: relationship.properties.strength,
        confidence: relationship.properties.confidence,
        weight: relationship.properties.weight,
        source: relationship.properties.source,
        context: relationship.properties.context,
        createdAt: relationship.properties.createdAt
      }
    })

    return result[0]?.relationshipId || relationship.id
  }

  // ============================================================================
  // Graph Traversal Operations
  // ============================================================================

  /**
   * Perform graph traversal from a starting entity
   */
  async traverseGraph(
    startEntityId: string,
    options: GraphTraversalOptions = {}
  ): Promise<GraphQueryResult> {
    const {
      maxDepth = 3,
      relationshipTypes = [],
      nodeLabels = [],
      limit = 100,
      includeProperties = true
    } = options

    const relationshipFilter = relationshipTypes.length > 0 
      ? `:${relationshipTypes.join('|')}`
      : ''
    
    const nodeFilter = nodeLabels.length > 0 
      ? `:${nodeLabels.join('|')}`
      : ''

    const cypher = `
      MATCH path = (start:Entity {id: $startEntityId})-[r${relationshipFilter}*1..${maxDepth}]-(end${nodeFilter})
      WITH path, length(path) as pathLength
      ORDER BY pathLength, end.centralityScore DESC
      LIMIT ${limit}
      RETURN 
        path,
        pathLength,
        nodes(path) as pathNodes,
        relationships(path) as pathRelationships,
        start,
        end
    `

    const results = await this.executeCypher(cypher, { startEntityId })

    return {
      query: cypher,
      parameters: { startEntityId, ...options },
      resultCount: results.length,
      executionTimeMs: 0, // Would be measured in real implementation
      paths: results.map(r => r.path),
      nodes: results.flatMap(r => r.pathNodes),
      relationships: results.flatMap(r => r.pathRelationships),
      metadata: {
        maxDepthReached: Math.max(...results.map(r => r.pathLength)),
        uniqueNodes: new Set(results.flatMap(r => r.pathNodes.map((n: any) => n.id))).size,
        uniqueRelationships: new Set(results.flatMap(r => r.pathRelationships.map((r: any) => r.id))).size
      }
    }
  }

  /**
   * Find entities by semantic similarity
   */
  async findSimilarEntities(
    embedding: number[],
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Neo4jEntity[]> {
    // Note: This would require a vector index in Neo4j
    // For now, we'll use a simpler approach
    const cypher = `
      MATCH (e:Entity)
      WHERE e.embedding IS NOT NULL
      RETURN e
      ORDER BY e.centralityScore DESC
      LIMIT ${limit}
    `

    const results = await this.executeCypher(cypher)
    return results.map(r => r.e.properties as Neo4jEntity)
  }

  // ============================================================================
  // Graph Analytics Operations
  // ============================================================================

  /**
   * Perform graph analytics
   */
  async performGraphAnalytics(
    algorithm: string,
    parameters: { [key: string]: any } = {},
    limit = 100
  ): Promise<GraphQueryResult> {
    let cypher: string
    
    switch (algorithm) {
      case 'pagerank':
        cypher = `
          CALL gds.pageRank.stream('entity-graph', {
            relationshipProjection: '*'
          })
          YIELD nodeId, score
          MATCH (n) WHERE id(n) = nodeId
          RETURN n, score
          ORDER BY score DESC
          LIMIT ${limit}
        `
        break
        
      case 'centrality':
        cypher = `
          CALL gds.betweenness.stream('entity-graph')
          YIELD nodeId, score
          MATCH (n) WHERE id(n) = nodeId
          RETURN n, score
          ORDER BY score DESC
          LIMIT ${limit}
        `
        break
        
      case 'community_detection':
        cypher = `
          CALL gds.louvain.stream('entity-graph')
          YIELD nodeId, communityId
          MATCH (n) WHERE id(n) = nodeId
          RETURN n, communityId
          ORDER BY communityId
        `
        break
        
      case 'shortest_path':
        if (!parameters?.startNodeId || !parameters?.endNodeId) {
          throw new Error('Shortest path requires startNodeId and endNodeId parameters')
        }
        cypher = `
          MATCH (start:Entity {id: $startNodeId}), (end:Entity {id: $endNodeId})
          CALL gds.shortestPath.dijkstra.stream('entity-graph', {
            sourceNode: start,
            targetNode: end
          })
          YIELD path, totalCost
          RETURN path, totalCost
        `
        break
        
      default:
        throw new Error(`Unsupported analytics algorithm: ${algorithm}`)
    }

    const results = await this.executeCypher(cypher, parameters)

    return {
      query: cypher,
      parameters: parameters,
      resultCount: results.length,
      executionTimeMs: 0,
      paths: [],
      nodes: results.map(r => r.n || r.node),
      relationships: [],
      metadata: {
        algorithm: algorithm,
        ...parameters
      }
    }
  }

  // ============================================================================
  // Health Check and Monitoring
  // ============================================================================

  /**
   * Check Neo4j health and get basic statistics
   */
  async checkHealth(): Promise<Neo4jHealthCheck> {
    try {
      const start = Date.now()
      
      const result = await this.executeCypher(`
        CALL db.labels() YIELD label
        WITH collect(label) as labels
        MATCH (n) 
        WITH labels, count(n) as nodeCount
        MATCH ()-[r]->()
        RETURN labels, nodeCount, count(r) as relationshipCount
      `)

      const latency = Date.now() - start

      return {
        healthy: true,
        latency,
        nodeCount: result[0]?.nodeCount || 0,
        relationshipCount: result[0]?.relationshipCount || 0
      }
    } catch (error) {
      return {
        healthy: false,
        latency: -1,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Create necessary indexes and constraints
   */
  async createIndexes(): Promise<void> {
    const indexQueries = [
      // Entity indexes
      'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
      'CREATE INDEX entity_type_idx IF NOT EXISTS FOR (e:Entity) ON (e.type)',
      'CREATE INDEX entity_centrality_idx IF NOT EXISTS FOR (e:Entity) ON (e.centralityScore)',
      
      // Document indexes  
      'CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE',
      'CREATE INDEX document_content_hash_idx IF NOT EXISTS FOR (d:Document) ON (d.contentHash)',
      
      // Chunk indexes
      'CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE',
      'CREATE INDEX chunk_document_idx IF NOT EXISTS FOR (c:Chunk) ON (c.documentId)',
    ]

    for (const query of indexQueries) {
      try {
        await this.executeCypher(query)
      } catch (error) {
        console.warn(`Failed to create index/constraint: ${query}`, error)
      }
    }
  }
}

/**
 * Factory function to create and configure Neo4j service
 */
export function createNeo4jService(config: Neo4jConfig): Neo4jService {
  return new Neo4jService(config)
}

/**
 * Get Neo4j configuration from environment variables
 */
export function getNeo4jConfigFromEnv(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
    maxConnectionPoolSize: process.env.NEO4J_MAX_POOL_SIZE ? parseInt(process.env.NEO4J_MAX_POOL_SIZE) : 50,
    connectionTimeout: process.env.NEO4J_CONNECTION_TIMEOUT ? parseInt(process.env.NEO4J_CONNECTION_TIMEOUT) : 30000
  }
}
