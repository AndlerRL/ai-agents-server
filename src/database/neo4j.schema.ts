/**
 * Neo4j Graph Database Schema for RAG Systems
 * Extends and utilizes existing PostgreSQL schema types
 * Provides graph-native operations for complex relationship queries
 */
import type {
	ContentType,
	Difficulty,
	// Import existing types from PostgreSQL schema
	Document,
	DocumentChunk,
	// Import existing enums
	EntityType,
	KnowledgeGraphEntity,
	QueryType,
	Strategy,
} from "./schema";

// ============================================================================
// Neo4j Node Labels (extending PostgreSQL types)
// ============================================================================

export interface Neo4jDocument extends Omit<Document, "metadata"> {
	// Neo4j specific properties
	nodeId: string;
	labels: string[];
	// Enhanced metadata for graph operations
	metadata: {
		sourceType?: "web" | "file" | "api" | "manual";
		domain?: string;
		language?: string;
		authorId?: string;
		organizationId?: string;
		projectId?: string;
		tags?: string[];
		// Graph analytics
		centralityScore?: number;
		communityId?: string;
		pageRank?: number;
		// Original metadata
		[key: string]: any;
	};
	// Graph relationships
	relatedDocuments?: string[];
	citedBy?: string[];
	cites?: string[];
}

export interface Neo4jChunk extends Omit<DocumentChunk, "metadata"> {
	// Neo4j specific properties
	nodeId: string;
	labels: string[];
	// Enhanced metadata for graph context
	metadata: {
		parentChunkId?: string;
		childChunkIds?: string[];
		siblingChunkIds?: string[];
		tokens?: number;
		language?: string;
		contentType?: ContentType;
		difficulty?: Difficulty;
		// Semantic relationships
		conceptIds?: string[];
		entityIds?: string[];
		topicIds?: string[];
		// Graph analytics
		semanticClusterId?: string;
		importanceScore?: number;
		// Original metadata
		[key: string]: any;
	};
}

export interface Neo4jEntity extends Omit<KnowledgeGraphEntity, "metadata"> {
	// Neo4j specific properties
	nodeId: string;
	labels: string[];
	// Enhanced metadata for rich entity representation
	metadata: {
		aliases?: string[];
		description?: string;
		confidence?: number;
		extractedFrom?: string[];
		// Additional graph properties
		importance?: number;
		centrality?: number;
		clusterId?: string;
		// Domain-specific properties
		domainSpecific?: {
			[domain: string]: any;
		};
		// Original metadata
		[key: string]: any;
	};
	// Graph statistics
	incomingRelationCount?: number;
	outgoingRelationCount?: number;
}

// New graph-specific node types
export interface Neo4jConcept {
	id: string;
	name: string;
	description?: string;
	domain: string;
	embedding?: number[];
	entityType: EntityType;
	createdAt: string;
	// Neo4j specific properties
	nodeId: string;
	labels: string[];
	metadata: {
		synonyms?: string[];
		relatedTerms?: string[];
		difficulty?: Difficulty;
		importance?: number;
		prerequisites?: string[];
		examples?: string[];
		applications?: string[];
		[key: string]: any;
	};
}

export interface Neo4jTopic {
	id: string;
	name: string;
	description?: string;
	domain: string;
	embedding?: number[];
	createdAt: string;
	// Neo4j specific properties
	nodeId: string;
	labels: string[];
	metadata: {
		subtopics?: string[];
		parentTopics?: string[];
		keywords?: string[];
		difficulty?: Difficulty;
		estimatedStudyTime?: number;
		prerequisites?: string[];
		[key: string]: any;
	};
}

// ============================================================================
// Neo4j Relationship Types (extending PostgreSQL relations)
// ============================================================================

export interface Neo4jRelationship {
	id: string;
	type: string;
	startNodeId: string;
	endNodeId: string;
	properties: {
		strength?: number;
		confidence?: number;
		weight?: number;
		createdAt: string;
		source?: string;
		extractedFrom?: string[];
		// Temporal properties
		validFrom?: string;
		validTo?: string;
		// Context properties
		context?: string[];
		// Relationship metadata
		[key: string]: any;
	};
}

// Document relationships
export interface DocumentRelationship extends Neo4jRelationship {
	type:
		| "CITES"
		| "CITED_BY"
		| "RELATED_TO"
		| "PART_OF"
		| "CONTAINS"
		| "DERIVED_FROM"
		| "SUPERSEDES"
		| "VERSION_OF";
}

// Chunk relationships
export interface ChunkRelationship extends Neo4jRelationship {
	type:
		| "FOLLOWS"
		| "PRECEDES"
		| "SIMILAR_TO"
		| "CONTAINS_CONCEPT"
		| "MENTIONS_ENTITY"
		| "BELONGS_TO_TOPIC"
		| "EXPLAINS"
		| "CONTRADICTS";
}

// Entity relationships (extending existing KnowledgeGraphRelation)
export interface EntityRelationship extends Neo4jRelationship {
	type:
		| "IS_A"
		| "PART_OF"
		| "RELATED_TO"
		| "WORKS_FOR"
		| "LOCATED_IN"
		| "CREATED_BY"
		| "INFLUENCES"
		| "DEPENDS_ON"
		| "IMPLEMENTS"
		| "USES";
}

// Concept relationships
export interface ConceptRelationship extends Neo4jRelationship {
	type:
		| "SUBCONCEPT_OF"
		| "PREREQUISITE_FOR"
		| "APPLIES_TO"
		| "CONTRADICTS"
		| "SUPPORTS"
		| "EXAMPLE_OF"
		| "GENERALIZES";
}

// Topic relationships
export interface TopicRelationship extends Neo4jRelationship {
	type:
		| "SUBTOPIC_OF"
		| "RELATED_TOPIC"
		| "COVERS_CONCEPT"
		| "REQUIRES_KNOWLEDGE"
		| "BUILDS_ON"
		| "APPLIED_IN";
}

// ============================================================================
// Neo4j Query Interfaces (extending PostgreSQL query types)
// ============================================================================

export interface Neo4jQuery {
	query: string;
	parameters?: Record<string, any>;
	strategy: Strategy;
	options?: {
		timeout?: number;
		database?: string;
		routing?: "read" | "write";
	};
}

export interface GraphTraversalQuery extends Neo4jQuery {
	startNode: {
		label: string;
		properties: Record<string, any>;
	};
	relationshipTypes?: string[];
	depth?: number;
	direction?: "INCOMING" | "OUTGOING" | "BOTH";
	filters?: {
		nodeFilters?: Record<string, any>;
		relationshipFilters?: Record<string, any>;
	};
}

export interface SemanticSearchQuery extends Neo4jQuery {
	embedding: number[];
	topK: number;
	similarityThreshold?: number;
	entityTypes?: EntityType[];
	conceptFilters?: string[];
	difficultyLevel?: Difficulty;
}

export interface PathFindingQuery extends Neo4jQuery {
	sourceNode: { label: string; properties: Record<string, any> };
	targetNode: { label: string; properties: Record<string, any> };
	maxDepth?: number;
	relationshipTypes?: string[];
	algorithm?: "shortestPath" | "allShortestPaths" | "dijkstra" | "aStar";
}

// ============================================================================
// Neo4j Result Types (extending PostgreSQL result types)
// ============================================================================

export interface Neo4jResult<T = any> {
	records: T[];
	summary: {
		query: string;
		queryType: string;
		counters: {
			nodesCreated: number;
			nodesDeleted: number;
			relationshipsCreated: number;
			relationshipsDeleted: number;
			propertiesSet: number;
			indexesAdded: number;
			indexesRemoved: number;
			constraintsAdded: number;
			constraintsRemoved: number;
		};
		plan?: any;
		profile?: any;
		notifications?: any[];
		resultAvailableAfter?: number;
		resultConsumedAfter?: number;
	};
}

export interface GraphRetrievalResult extends Neo4jResult {
	nodes: (
		| Neo4jDocument
		| Neo4jChunk
		| Neo4jEntity
		| Neo4jConcept
		| Neo4jTopic
	)[];
	relationships: Neo4jRelationship[];
	paths: Array<{
		nodes: any[];
		relationships: any[];
		length: number;
		weight?: number;
	}>;
	relevanceScores: number[];
	explanation?: string;
	strategy: Strategy;
	queryType: QueryType;
}

// ============================================================================
// Neo4j Schema Constraints and Indexes
// ============================================================================

export interface Neo4jSchemaDefinition {
	// Node uniqueness constraints
	constraints: {
		documents: string[];
		chunks: string[];
		entities: string[];
		concepts: string[];
		topics: string[];
	};

	// Indexes for performance
	indexes: {
		// Text search indexes
		fullTextSearch: string[];
		// Property indexes
		properties: string[];
		// Vector similarity indexes (when available in Neo4j)
		vectorSimilarity?: string[];
		// Composite indexes
		composite: Array<{
			name: string;
			properties: string[];
		}>;
	};

	// Relationship indexes
	relationshipIndexes: string[];
}

// ============================================================================
// Graph Analytics Types
// ============================================================================

export interface GraphAnalytics {
	centrality: {
		betweenness: Record<string, number>;
		closeness: Record<string, number>;
		pageRank: Record<string, number>;
		eigenvector: Record<string, number>;
		degree: Record<string, number>;
	};
	clustering: {
		communities: Array<{
			id: string;
			nodes: string[];
			modularity: number;
			description?: string;
		}>;
		clusteringCoefficient: number;
		triangleCount: number;
	};
	pathAnalysis: {
		shortestPaths: Array<{
			from: string;
			to: string;
			path: string[];
			length: number;
			weight?: number;
		}>;
		allPaths: Array<{
			from: string;
			to: string;
			paths: string[][];
		}>;
	};
	similarity: {
		nodeSimilarity: Array<{
			node1: string;
			node2: string;
			similarity: number;
			method: "jaccard" | "cosine" | "euclidean";
		}>;
	};
}

// ============================================================================
// Hybrid Database Operations (PostgreSQL + Neo4j)
// ============================================================================

export interface HybridDatabaseOperation {
	operation: "create" | "read" | "update" | "delete";
	postgresQuery?: {
		table: string;
		query: any;
		parameters?: any[];
	};
	neo4jQuery?: Neo4jQuery;
	syncMode: "immediate" | "eventual" | "manual";
	conflictResolution?: "postgres_wins" | "neo4j_wins" | "merge" | "error";
	strategy: Strategy;
}

export interface SyncStatus {
	lastSync: Date;
	postgresVersion: string;
	neo4jVersion: string;
	pendingOperations: number;
	conflicts: Array<{
		id: string;
		type: "data_mismatch" | "schema_mismatch" | "constraint_violation";
		description: string;
		resolution?: string;
		affectedNodes?: string[];
		affectedRelationships?: string[];
	}>;
}

// ============================================================================
// Database Router Configuration
// ============================================================================

export interface DatabaseRoutingConfig {
	strategy: Strategy;
	routing: {
		// Which operations go to which database
		create: "postgres" | "neo4j" | "both";
		read: "postgres" | "neo4j" | "hybrid";
		update: "postgres" | "neo4j" | "both";
		delete: "postgres" | "neo4j" | "both";
	};
	// Conditions for routing decisions
	conditions: {
		useNeo4j: Array<{
			field: string;
			operator: "equals" | "contains" | "gt" | "lt" | "in";
			value: any;
		}>;
		usePostgres: Array<{
			field: string;
			operator: "equals" | "contains" | "gt" | "lt" | "in";
			value: any;
		}>;
	};
}

// ============================================================================
// Export Types for RAG Integration
// ============================================================================

// Note: All interfaces are already exported above, no need for duplicate exports

// ============================================================================
// Constants for Graph Schema
// ============================================================================

export const NEO4J_NODE_LABELS = {
	DOCUMENT: "Document",
	CHUNK: "Chunk",
	ENTITY: "Entity",
	CONCEPT: "Concept",
	TOPIC: "Topic",
	AUTHOR: "Author",
	ORGANIZATION: "Organization",
	PROJECT: "Project",
} as const;

export const NEO4J_RELATIONSHIP_TYPES = {
	// Document relationships
	CITES: "CITES",
	CITED_BY: "CITED_BY",
	RELATED_TO: "RELATED_TO",
	PART_OF: "PART_OF",
	CONTAINS: "CONTAINS",
	DERIVED_FROM: "DERIVED_FROM",

	// Chunk relationships
	FOLLOWS: "FOLLOWS",
	PRECEDES: "PRECEDES",
	SIMILAR_TO: "SIMILAR_TO",
	CONTAINS_CONCEPT: "CONTAINS_CONCEPT",
	MENTIONS_ENTITY: "MENTIONS_ENTITY",
	BELONGS_TO_TOPIC: "BELONGS_TO_TOPIC",

	// Entity relationships
	IS_A: "IS_A",
	WORKS_FOR: "WORKS_FOR",
	LOCATED_IN: "LOCATED_IN",
	CREATED_BY: "CREATED_BY",
	INFLUENCES: "INFLUENCES",
	DEPENDS_ON: "DEPENDS_ON",

	// Concept relationships
	SUBCONCEPT_OF: "SUBCONCEPT_OF",
	PREREQUISITE_FOR: "PREREQUISITE_FOR",
	APPLIES_TO: "APPLIES_TO",
	CONTRADICTS: "CONTRADICTS",
	SUPPORTS: "SUPPORTS",
} as const;
