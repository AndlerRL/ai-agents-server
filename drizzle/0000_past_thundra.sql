CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"granularity" text NOT NULL,
	"chunk_size" integer NOT NULL,
	"embedding" vector(1536),
	"keyword_vector" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_shard_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"shard_id" uuid NOT NULL,
	"mapping_weight" real DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"source" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding_model" text NOT NULL,
	"embedding_model_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"indexed_at" timestamp,
	CONSTRAINT "documents_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "embedding_shards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shard_name" text NOT NULL,
	"shard_type" text NOT NULL,
	"document_count" integer DEFAULT 0,
	"average_quality" real DEFAULT 0,
	"last_updated" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"avg_retrieval_time_ms" integer DEFAULT 0,
	"index_size_mb" integer DEFAULT 0,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "embedding_shards_shard_name_unique" UNIQUE("shard_name")
);
--> statement-breakpoint
CREATE TABLE "knowledge_graph_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_entity_id" text NOT NULL,
	"target_entity_id" text NOT NULL,
	"relationship_type" text NOT NULL,
	"relationship_strength" real DEFAULT 1,
	"relation_embedding" vector(1536),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_graph" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_name" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrieval_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"chunk_id" uuid,
	"entity_id" text,
	"dense_score" real,
	"sparse_score" real,
	"hybrid_score" real,
	"rerank_score" real,
	"final_score" real NOT NULL,
	"rank" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "retrieval_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"query_hash" text NOT NULL,
	"query_difficulty" text,
	"query_length" integer NOT NULL,
	"query_type" text,
	"strategy" text NOT NULL,
	"top_k" integer NOT NULL,
	"granularity" text NOT NULL,
	"latency_ms" integer,
	"embedding_gen_time_ms" integer,
	"retrieval_time_ms" integer,
	"reranking_time_ms" integer,
	"results_returned" integer,
	"user_feedback" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shard_mappings" ADD CONSTRAINT "document_shard_mappings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_shard_mappings" ADD CONSTRAINT "document_shard_mappings_shard_id_embedding_shards_id_fk" FOREIGN KEY ("shard_id") REFERENCES "public"."embedding_shards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_graph_relations" ADD CONSTRAINT "knowledge_graph_relations_source_entity_id_knowledge_graph_entity_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."knowledge_graph"("entity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_graph_relations" ADD CONSTRAINT "knowledge_graph_relations_target_entity_id_knowledge_graph_entity_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."knowledge_graph"("entity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_results" ADD CONSTRAINT "retrieval_results_session_id_retrieval_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."retrieval_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_results" ADD CONSTRAINT "retrieval_results_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrieval_results" ADD CONSTRAINT "retrieval_results_entity_id_knowledge_graph_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."knowledge_graph"("entity_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "chunks_granularity_idx" ON "document_chunks" USING btree ("granularity");--> statement-breakpoint
CREATE INDEX "chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_embedding_ivf_idx" ON "document_chunks" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "shard_mappings_document_idx" ON "document_shard_mappings" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "shard_mappings_shard_idx" ON "document_shard_mappings" USING btree ("shard_id");--> statement-breakpoint
CREATE INDEX "shard_mappings_composite_idx" ON "document_shard_mappings" USING btree ("document_id","shard_id");--> statement-breakpoint
CREATE INDEX "documents_source_idx" ON "documents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "documents_embedding_model_idx" ON "documents" USING btree ("embedding_model");--> statement-breakpoint
CREATE INDEX "documents_content_hash_idx" ON "documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "shards_name_idx" ON "embedding_shards" USING btree ("shard_name");--> statement-breakpoint
CREATE INDEX "shards_type_idx" ON "embedding_shards" USING btree ("shard_type");--> statement-breakpoint
CREATE INDEX "shards_active_idx" ON "embedding_shards" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "kg_relations_source_idx" ON "knowledge_graph_relations" USING btree ("source_entity_id");--> statement-breakpoint
CREATE INDEX "kg_relations_target_idx" ON "knowledge_graph_relations" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "kg_relations_type_idx" ON "knowledge_graph_relations" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "kg_entity_idx" ON "knowledge_graph" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "kg_type_idx" ON "knowledge_graph" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "kg_embedding_idx" ON "knowledge_graph" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "retrieval_results_session_idx" ON "retrieval_results" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "retrieval_results_score_idx" ON "retrieval_results" USING btree ("final_score");--> statement-breakpoint
CREATE INDEX "retrieval_results_rank_idx" ON "retrieval_results" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "retrieval_query_hash_idx" ON "retrieval_sessions" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX "retrieval_strategy_idx" ON "retrieval_sessions" USING btree ("strategy");--> statement-breakpoint
CREATE INDEX "retrieval_difficulty_idx" ON "retrieval_sessions" USING btree ("query_difficulty");--> statement-breakpoint
CREATE INDEX "retrieval_created_at_idx" ON "retrieval_sessions" USING btree ("created_at");