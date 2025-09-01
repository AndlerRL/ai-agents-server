/**
 * Dual Database Schema Configuration
 * PostgreSQL (public schema) + Neo4j (graph_public equivalent)
 * 
 * Strategy:
 * - PostgreSQL: Optimized for vector similarity, analytics, and traditional retrieval
 * - Neo4j: Optimized for graph traversal, entity relationships, and graph-based RAG
 */

export const DatabaseConfig = {
  // PostgreSQL Configuration
  postgres: {
    schemas: {
      public: 'public',           // Main vector-based RAG operations
      graph_support: 'graph_support'  // Graph metadata and bridge tables
    },
    features: {
      vectorSimilarity: true,
      analytics: true,
      caching: true,
      fullTextSearch: true
    }
  },
  
  // Neo4j Configuration
  neo4j: {
    databases: {
      main: 'neo4j',              // Main graph database
      analytics: 'graph_analytics' // Graph analytics and metrics
    },
    features: {
      graphTraversal: true,
      entityResolution: true,
      relationshipInference: true,
      communityDetection: true
    }
  }
} as const

// Database Selection Strategy
export enum DatabaseStrategy {
  // Use PostgreSQL only
  POSTGRES_ONLY = 'postgres_only',
  
  // Use Neo4j only  
  NEO4J_ONLY = 'neo4j_only',
  
  // Use both databases with smart routing
  HYBRID = 'hybrid',
  
  // Use PostgreSQL with graph metadata bridge
  POSTGRES_WITH_GRAPH_BRIDGE = 'postgres_with_graph_bridge',
  
  // Use Neo4j with vector similarity fallback
  NEO4J_WITH_VECTOR_FALLBACK = 'neo4j_with_vector_fallback'
}

// Query Complexity Assessment for Database Routing
export enum QueryComplexity {
  SIMPLE_VECTOR = 'simple_vector',           // Pure similarity search
  ENTITY_LOOKUP = 'entity_lookup',           // Single entity queries
  RELATIONSHIP_QUERY = 'relationship_query', // 1-2 hop relationships
  COMPLEX_GRAPH = 'complex_graph',           // Multi-hop, community detection
  HYBRID_QUERY = 'hybrid_query'              // Requires both vector + graph
}

export type DatabaseRoutingDecision = {
  strategy: DatabaseStrategy
  primaryDatabase: 'postgres' | 'neo4j'
  fallbackDatabase?: 'postgres' | 'neo4j'
  reasoning: string
  estimatedComplexity: QueryComplexity
}
