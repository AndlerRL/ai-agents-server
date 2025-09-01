# Dual-Database Architecture Documentation

## Overview

This system implements a **dual-database architecture** combining PostgreSQL with pgvector and Neo4j to provide optimal retrieval strategies for different types of queries. The architecture supports both traditional vector similarity searches and graph-native operations.

## Architecture Components

### 1. Database Schema Design

#### Public Schema (PostgreSQL)

- **Purpose**: Traditional operations with basic graph support.
- **Primary Use**: Vector similarity searches, simple entity lookups.
- **Tables**:
  - `documents` - Document storage with Neo4j sync fields.
  - `document_chunks` - Text chunks with embeddings.
  - `knowledge_graph` - Entity storage with graph support.
  - `knowledge_graph_relations` - Basic relationship storage.
  - `retrieval_sessions` - Query analytics and performance tracking.
  - `retrieval_results` - Search results with database source tracking.

#### Graph Public Schema (PostgreSQL)

- **Purpose**: Optimized for Neo4j integration and graph operations.
- **Primary Use**: Complex graph analytics, relationship traversal.
- **Tables**:
  - `graph_documents` - Enhanced document metadata for graph operations.
  - `graph_chunks` - Chunks with semantic density metrics.
  - `graph_entities` - Entities optimized for graph analytics.
  - `graph_relationships` - Advanced relationship tracking.
  - `database_sync_log` - Synchronization tracking and conflict resolution.

### 2. Neo4j Integration

#### Neo4j Schema (`src/database/neo4j-schema.ts`)

- **Type Extension**: Extends PostgreSQL types.
- **Key Types**:
  - `Neo4jDocument` - Documents with graph-specific metadata.
  - `Neo4jChunk` - Chunks with semantic density and graph depth.
  - `Neo4jEntity` - Entities with centrality scores and clustering.
  - `Neo4jRelationship` - Relationships with strength and confidence metrics.

#### Neo4j Service (`src/database/neo4j-service.ts`)

- **Connection Management**: Driver initialization and session handling.
- **CRUD Operations**: Document, entity, and relationship management.
- **Graph Traversal**: Multi-hop relationship exploration.
- **Analytics Support**: PageRank, centrality, community detection.

### 3. Database Router (`src/database/database-router.ts`)

#### Routing Strategies

1. **Vector-First Strategy**: Prioritizes PostgreSQL for semantic similarity.
2. **Graph-First Strategy**: Prioritizes Neo4j for relationship-rich queries.
3. **Adaptive Strategy**: Intelligently routes based on query characteristics.

#### Query Context Analysis

- **Query Types**: `entity_lookup`, `relationship_traversal`, `semantic_search`, `hybrid_search`, `graph_analytics`.
- **Complexity Levels**: `simple`, `medium`, `complex`.
- **Routing Decisions**: Primary/secondary database selection with reasoning.

### 4. Synchronization Service (`src/database/sync-service.ts`)

#### Sync Operations

- **Bidirectional Sync**: PostgreSQL ↔ Neo4j data synchronization.
- **Conflict Resolution**: Multiple strategies for handling data conflicts.
- **Audit Trail**: Complete sync operation logging.

#### Sync Strategies

- `postgres_to_neo4j`: Update Neo4j from PostgreSQL changes.
- `neo4j_to_postgres`: Update PostgreSQL from Neo4j changes.
- `bidirectional`: Full two-way synchronization.

## Usage Patterns

### 1. Simple Semantic Search

```typescript
const context = createQueryContext()
  .query("Find documents about machine learning")
  .type('semantic_search')
  .complexity('simple')
  .build()

const result = await router.executeQuery(context, async (primary) => {
  // Uses PostgreSQL with pgvector
  return await primary.select().from(documents)
})
```

### 2. Complex Graph Traversal

```typescript
const context = createQueryContext()
  .query("Find all entities connected to 'AI' within 3 hops")
  .type('relationship_traversal')
  .complexity('complex')
  .traversalDepth(3)
  .build()

const result = await router.executeQuery(context, async (primary) => {
  // Uses Neo4j for graph operations
  return await (primary as Neo4jService).traverseGraph('AI', { maxDepth: 3 })
})
```

### 3. Hybrid Approach

```typescript
const context = createQueryContext()
  .query("Semantic search with relationship enhancement")
  .type('hybrid_search')
  .complexity('medium')
  .build()

const result = await router.executeQuery(context, async (primary, secondary) => {
  // Combines PostgreSQL semantic search with Neo4j relationship data
  const semanticResults = await primary.select().from(documents)
  const graphEnhancement = await secondary.traverseGraph(entityId)
  return mergeResults(semanticResults, graphEnhancement)
})
```

## Configuration

### Environment Variables

```bash
# PostgreSQL (existing)
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j
```

### Docker Compose Enhancement

```yaml
services:
  neo4j:
    image: neo4j:5.15
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["graph-data-science"]'
    ports:
      - "7474:7474"  # Browser
      - "7687:7687"  # Bolt
```

## Key Features

### 1. Intelligent Routing

- **Automatic Strategy Selection**: Based on query characteristics.
- **Performance Optimization**: Routes queries to optimal database.
- **Fallback Support**: Secondary database for enhanced results.

### 2. Comprehensive Sync

- **Version Tracking**: PostgreSQL and Neo4j version management.
- **Conflict Detection**: Automatic identification of data conflicts.
- **Audit Trail**: Complete operation logging for monitoring.

### 3. Graph Analytics

- **Native Graph Operations**: PageRank, centrality, community detection.
- **Relationship Traversal**: Multi-hop exploration with depth control.
- **Semantic Enhancement**: Vector similarity combined with graph relationships.

### 4. Schema Separation

- **Public Schema**: Traditional operations with basic graph support.
- **Graph Public Schema**: Optimized for Neo4j integration.
- **Type Extension**: Neo4j types extend PostgreSQL types for consistency.

## Benefits

### 1. Performance Optimization

- **Vector Similarity**: PostgreSQL + pgvector for fast semantic search.
- **Graph Operations**: Neo4j for complex relationship queries.
- **Query Routing**: Automatic selection of optimal database.

### 2. Data Consistency

- **Bidirectional Sync**: Keeps both databases synchronized.
- **Conflict Resolution**: Multiple strategies for handling conflicts.
- **Version Control**: Track changes across both systems.

### 3. Scalability

- **Independent Scaling**: Scale PostgreSQL and Neo4j independently.
- **Load Distribution**: Distribute different query types across databases.
- **Flexible Architecture**: Easy to add new routing strategies.

### 4. Developer Experience

- **Type Safety**: Full TypeScript support across both databases.
- **Unified Interface**: Single API for both database systems.
- **Rich Analytics**: Comprehensive query performance tracking.

## Migration Path

### Phase 1: Schema Enhancement ✅

- Dual schema implementation.
- Neo4j sync field addition.
- Type system extension.

### Phase 2: Service Implementation ✅

- Neo4j service creation.
- Database router implementation.
- Sync service foundation.

### Phase 3: Integration (Next Steps)

- RAG service updates.
- Query routing implementation.
- Performance monitoring.

### Phase 4: Optimization (Future)

- Query optimization based on analytics.
- Advanced conflict resolution.
- Machine learning for routing decisions.

## Monitoring and Analytics

### 1. Query Performance

- **Routing Decisions**: Track which database was chosen and why.
- **Execution Times**: Compare performance across databases.
- **Success Rates**: Monitor query success and failure rates.

### 2. Sync Health

- **Sync Status**: Track synchronization success and failures.
- **Conflict Frequency**: Monitor data conflict occurrence.
- **Data Consistency**: Verify data integrity across systems.

### 3. Usage Patterns

- **Query Types**: Analyze most common query patterns.
- **Database Utilization**: Track load distribution.
- **Performance Trends**: Identify optimization opportunities.

This dual-database architecture provides a robust foundation for handling both traditional vector similarity searches and complex graph operations, with intelligent routing ensuring optimal performance for different query types.

> _PERSONAL NOTE: As said, this architecture is designed to leverage the strengths of both PostgreSQL and Neo4j, providing a seamless experience for developers and users alike. I might be upgrading the system to include more advanced features in the future, but mainly it is for my self learning to get away from the theoretical aspects and into practical implementation away of the projects that I haven been working on or I plan to work on my projects._
>
> _Use it well._
