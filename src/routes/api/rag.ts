import { Elysia } from "elysia";
import type { MainRagService } from "../../rag";

export const createRagRoutes = (getRagService: () => MainRagService | undefined) => new Elysia({ prefix: "/v1/rag" })
	.get(
		"/",
		() => ({
			title: "Dual-Database RAG System API",
			description:
				"Advanced Retrieval-Augmented Generation with PostgreSQL + pgvector and Neo4j dual-database architecture",
			version: "1.0.0",
			architecture: {
				databases: {
					postgresql: {
						role: "Primary vector database",
						features: [
							"pgvector",
							"semantic_search",
							"traditional_queries",
							"dual_schema_support",
						],
						schemas: ["public", "graph_public"],
					},
					neo4j: {
						role: "Graph relationship database",
						features: [
							"graph_traversal",
							"relationship_analysis",
							"centrality_metrics",
							"community_detection",
						],
					},
				},
				routing: {
					intelligent_routing:
						"Automatic database selection based on query characteristics",
					strategies: ["vector_first", "graph_first", "adaptive"],
					performance_optimization:
						"Query-specific database routing for optimal performance",
				},
			},
			endpoints: {
				retrieve: "/v1/rag/retrieve",
				documents: "/v1/rag/documents",
				health: "/v1/rag/health",
				metrics: "/v1/rag/metrics",
				database_status: "/v1/database/status",
				routing_info: "/v1/database/router",
			},
			strategies: [
				"retrieve_read",
				"hybrid",
				"two_stage_rerank",
				"fusion_in_decoder",
				"augmented_reranking",
				"federated",
				"graph_rag",
				"adaptive",
			],
		}),
		{
			detail: {
				tags: ["RAG System"],
				summary: "Dual-database RAG API information",
				description:
					"Get comprehensive information about the dual-database RAG system architecture and capabilities",
			},
		},
	)

	// Main retrieval endpoint
	.post(
		"/retrieve",
		async ({ body }: { body: any }) => {
			try {
				const ragService = getRagService();
				if (!ragService) {
					return {
						success: false,
						error: "RAG system not initialized",
						message: "RAG service is not available",
					};
				}

				const {
					query,
					strategy,
					topK,
					granularity,
					includeMetadata,
					filters,
				} = body as {
					query: string;
					strategy?:
						| "retrieve_read"
						| "hybrid"
						| "two_stage_rerank"
						| "fusion_in_decoder"
						| "augmented_reranking"
						| "federated"
						| "graph_rag"
						| "adaptive";
					topK?: number;
					granularity?: "adaptive" | "coarse" | "fine";
					includeMetadata?: boolean;
					filters?: object;
				};

				if (!query) {
					return {
						success: false,
						error: "Missing query",
						message: "Query text is required",
					};
				}

				const ragQuery = {
					text: query,
					strategy,
					topK: topK || 5,
					granularity: granularity || "coarse",
					includeMetadata: includeMetadata || false,
					filters,
					queryId: crypto.randomUUID(),
					clientId: "web-client",
					metadata: {
						requestId: crypto.randomUUID(),
						timestamp: new Date().toISOString(),
					},
				};

				const response = await ragService.retrieve(ragQuery);

				return {
					success: true,
					data: response,
				};
			} catch (error) {
				console.error("RAG retrieval error:", error);
				return {
					success: false,
					error: "RAG retrieval failed",
					message: String(error),
				};
			}
		},
		{
			detail: {
				tags: ["RAG System"],
				summary: "Retrieve documents",
				description:
					"Retrieve relevant documents using RAG system with various strategies",
			},
		}
	)

	// Adaptive retrieval
	.post(
		"/adaptive",
		async ({ body }: { body: any }) => {
			try {
				const ragService = getRagService();
				if (!ragService) {
					return {
						success: false,
						error: "RAG system not initialized",
					};
				}

				const { query, topK, includeMetadata } = body as {
					query: string;
					topK?: number;
					includeMetadata?: boolean;
				};

				const ragQuery = {
					text: query,
					topK: topK || 5,
					granularity: "adaptive" as const,
					includeMetadata: includeMetadata || false,
					queryId: crypto.randomUUID(),
					clientId: "web-client",
				};

				const response = await ragService.adaptiveRetrieve(ragQuery);

				return {
					success: true,
					data: response,
					explanation:
						"Used adaptive strategy selection based on query characteristics",
				};
			} catch (error) {
				return {
					success: false,
					error: "Adaptive retrieval failed",
					message: String(error),
				};
			}
		},
		{
			detail: {
				tags: ["RAG System"],
				summary: "Adaptive retrieval",
				description:
					"Automatically select optimal retrieval strategy based on query characteristics",
			},
		}
	)

	// Document management
	.group("/documents", (app) =>
		app
			.post(
				"/",
				async ({ body }: { body: any }) => {
					try {
						const ragService = getRagService();
						if (!ragService) {
							return { success: false, error: "RAG system not initialized" };
						}

						const { content, metadata } = body as {
							content: string;
							metadata?: Record<string, unknown>;
						};
						const documentId = await ragService.addDocument(
							content,
							metadata
						);

						return {
							success: true,
							data: { documentId },
							message: "Document added successfully",
						};
					} catch (error) {
						return {
							success: false,
							error: "Failed to add document",
							message: String(error),
						};
					}
				},
				{
					detail: {
						tags: ["RAG System"],
						summary: "Add document",
						description: "Add a new document to the RAG system",
					},
				}
			)

						.post("/batch", async ({ body }: { body: any }) => {
				try {
					const ragService = getRagService();
					if (!ragService) {
						return { success: false, error: "RAG system not initialized" };
					}

					const { documents } = body as {
						documents: {
							content: string;
							metadata?: Record<string, unknown>;
						}[];
					};
					const documentIds = await ragService.addDocuments(documents);

					return {
						success: true,
						data: { documentIds },
						message: `Added ${documentIds.length} documents`,
					};
				} catch (error) {
					return {
						success: false,
						error: "Failed to add documents",
						message: String(error),
					};
				}
			})

			.delete(
				"/:id",
				async ({ params }: { params: Record<string, string> }) => {
					try {
						const ragService = getRagService();
						if (!ragService) {
							return { success: false, error: "RAG system not initialized" };
						}

						await ragService.deleteDocument(params.id);

						return {
							success: true,
							message: "Document deleted successfully",
						};
					} catch (error) {
						return {
							success: false,
							error: "Failed to delete document",
							message: String(error),
						};
					}
				}
			)
	)

	// Health and metrics
	.get(
		"/health",
		async () => {
			try {
				const ragService = getRagService();
				if (!ragService) {
					return {
						status: "unhealthy",
						error: "RAG system not initialized",
					};
				}

				const health = await ragService.healthCheck();
				return health;
			} catch (error) {
				return {
					status: "unhealthy",
					error: "Health check failed",
					message: String(error),
				};
			}
		},
		{
			detail: {
				tags: ["RAG System"],
				summary: "Health check",
				description: "Check RAG system health status",
			},
		}
	)

	.get(
		"/metrics",
		async () => {
			try {
				const ragService = getRagService();
				if (!ragService) {
					return { error: "RAG system not initialized" };
				}

				const [systemMetrics, indexStats] = await Promise.all([
					ragService.getSystemMetrics(),
					ragService.getIndexStats(),
				]);

				return {
					success: true,
					data: {
						system: systemMetrics,
						index: indexStats,
					},
				};
			} catch (error) {
				return {
					success: false,
					error: "Failed to get metrics",
					message: String(error),
				};
			}
		},
		{
			detail: {
				tags: ["RAG System"],
				summary: "System metrics",
				description: "Get RAG system performance metrics and statistics",
			},
		}
	);
