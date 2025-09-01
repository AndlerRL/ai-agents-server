CREATE TYPE "public"."content_type" AS ENUM('text', 'code', 'markdown', 'json', 'xml', 'html', 'documentation', 'article', 'reference');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."embedding_model" AS ENUM('text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large', 'all-MiniLM-L6-v2', 'all-mpnet-base-v2', 'multi-qa-MiniLM-L6-cos-v1');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('concept', 'person', 'organization', 'location', 'event', 'product', 'technology', 'methodology', 'process');--> statement-breakpoint
CREATE TYPE "public"."granularity" AS ENUM('fine', 'coarse');--> statement-breakpoint
CREATE TYPE "public"."query_type" AS ENUM('factual', 'analytical', 'creative', 'comparison', 'summarization', 'reasoning');--> statement-breakpoint
CREATE TYPE "public"."shard_type" AS ENUM('domain', 'temporal', 'source', 'quality', 'language', 'geographic');--> statement-breakpoint
CREATE TYPE "public"."strategy" AS ENUM('retrieve_read', 'hybrid', 'two_stage_rerank', 'fusion_in_decoder', 'augmented_reranking', 'federated', 'graph_rag', 'adaptive');--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "granularity" SET DATA TYPE granularity;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "embedding_model" SET DATA TYPE embedding_model;--> statement-breakpoint
ALTER TABLE "embedding_shards" ALTER COLUMN "shard_type" SET DATA TYPE shard_type;--> statement-breakpoint
ALTER TABLE "knowledge_graph" ALTER COLUMN "entity_type" SET DATA TYPE entity_type;--> statement-breakpoint
ALTER TABLE "retrieval_sessions" ALTER COLUMN "query_difficulty" SET DATA TYPE difficulty;--> statement-breakpoint
ALTER TABLE "retrieval_sessions" ALTER COLUMN "query_type" SET DATA TYPE query_type;--> statement-breakpoint
ALTER TABLE "retrieval_sessions" ALTER COLUMN "strategy" SET DATA TYPE strategy;--> statement-breakpoint
ALTER TABLE "retrieval_sessions" ALTER COLUMN "granularity" SET DATA TYPE granularity;