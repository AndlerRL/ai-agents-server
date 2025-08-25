/**
 * Core type definitions for the agentic AI server
 * Provides type safety and contract definitions across the application
 */

import type { ReactNode } from 'react'
import type { OpenAI } from 'openai'

// ============================================================================
// Server State & Configuration Types
// ============================================================================

export interface ServerState {
  agents: Map<string, AgentInstance>
  activeConnections: Map<string, WebSocket>
  statistics: ServerStatistics
  memory: MemoryStore
}

export interface ServerConfig {
  port: number
  environment: 'development' | 'production' | 'test'
  openai: {
    apiKey: string
    organization?: string
    baseURL?: string
  }
  memory: {
    provider: 'memory' | 'redis' | 'postgresql'
    maxSize: number
    ttl: number
  }
  chunking: ChunkingConfig
}

// ============================================================================
// Agent & LLM Types
// ============================================================================

export interface AgentInstance {
  id: string
  name: string
  model: LLMModel
  tools: Tool[]
  memory: MemoryStore
  status: 'idle' | 'processing' | 'error'
  createdAt: Date
  lastActivity: Date
}

export interface LLMModel {
  provider: 'openai' | 'anthropic' | 'custom'
  model: string
  config: LLMConfig
}

export interface LLMConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  // Expansion point: Add custom model parameters
  custom?: Record<string, unknown>
}

// ============================================================================
// Tool & Function Types
// ============================================================================

export interface Tool {
  name: string
  description: string
  parameters: ToolParameters
  handler: ToolHandler
  category: 'search' | 'analysis' | 'generation' | 'custom'
}

export interface ToolParameters {
  type: 'object'
  properties: Record<string, ParameterSchema>
  required?: string[]
}

export interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: ParameterSchema
  properties?: Record<string, ParameterSchema>
}

export type ToolHandler = (parameters: Record<string, unknown>) => Promise<ToolResult>

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// Memory & Document Types
// ============================================================================

export interface MemoryStore {
  store: (key: string, value: MemoryEntry) => Promise<void>
  retrieve: (key: string) => Promise<MemoryEntry | null>
  search: (query: string, limit?: number) => Promise<MemoryEntry[]>
  delete: (key: string) => Promise<boolean>
  clear: () => Promise<void>
}

export interface MemoryEntry {
  id: string
  content: string
  metadata: MemoryMetadata
  embedding?: number[]
  timestamp: Date
  ttl?: number
}

export interface MemoryMetadata {
  source: string
  type: 'conversation' | 'document' | 'tool_result' | 'system'
  tags: string[]
  context?: Record<string, unknown>
}

export interface ChunkingConfig {
  strategy: 'fixed' | 'semantic' | 'sliding' | 'custom'
  chunkSize: number
  overlap: number
  // Expansion point: Custom chunking strategies
  customStrategy?: (text: string, config: ChunkingConfig) => Chunk[]
}

export interface Chunk {
  id: string
  content: string
  metadata: ChunkMetadata
  embedding?: number[]
}

export interface ChunkMetadata {
  source: string
  index: number
  totalChunks: number
  startOffset: number
  endOffset: number
}

// ============================================================================
// Webhook & Streaming Types
// ============================================================================

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  payload: Record<string, unknown>
  timestamp: Date
  source: string
}

export type WebhookEventType = 
  | 'agent.created'
  | 'agent.processing'
  | 'agent.completed'
  | 'agent.error'
  | 'tool.executed'
  | 'memory.updated'
  | 'conversation.started'
  | 'conversation.ended'

export interface StreamMessage {
  id: string
  type: 'data' | 'error' | 'complete'
  data?: unknown
  error?: string
  timestamp: Date
}

// ============================================================================
// Statistics & Logging Types
// ============================================================================

export interface ServerStatistics {
  totalRequests: number
  activeAgents: number
  totalTokensUsed: number
  averageResponseTime: number
  errorRate: number
  memoryUsage: MemoryUsage
  apiCalls: ApiCallStats[]
}

export interface MemoryUsage {
  total: number
  used: number
  available: number
  entries: number
}

export interface ApiCallStats {
  endpoint: string
  count: number
  averageLatency: number
  lastCalled: Date
  errorCount: number
}

export interface LogEntry {
  id: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  timestamp: Date
  context: Record<string, unknown>
  source: string
}

// ============================================================================
// API Route Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    timestamp: Date
    requestId: string
    processingTime: number
  }
}

export interface ChatRequest {
  message: string
  agentId?: string
  model?: string
  tools?: string[]
  context?: Record<string, unknown>
  stream?: boolean
}

export interface ChatResponse {
  message: string
  agentId: string
  toolCalls?: ToolCall[]
  metadata: {
    model: string
    tokensUsed: number
    processingTime: number
  }
}

export interface ToolCall {
  id: string
  name: string
  parameters: Record<string, unknown>
  result?: ToolResult
}

// ============================================================================
// Client State Types (React Context)
// ============================================================================

export interface ClientState {
  connected: boolean
  agents: AgentInstance[]
  activeAgent?: string
  messages: ChatMessage[]
  isLoading: boolean
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface ClientAction {
  type: 'SET_CONNECTED' | 'ADD_AGENT' | 'SET_ACTIVE_AGENT' | 'ADD_MESSAGE' | 'SET_LOADING' | 'SET_ERROR'
  payload?: unknown
}

// ============================================================================
// Extension Points & Plugin Types
// ============================================================================

/**
 * Extension point for custom model providers
 * Implement this interface to add support for new LLM providers
 */
export interface ModelProvider {
  name: string
  initialize: (config: Record<string, unknown>) => Promise<void>
  chat: (messages: ChatMessage[], config: LLMConfig) => Promise<ChatResponse>
  embed: (text: string) => Promise<number[]>
  // Expansion point: Add provider-specific methods
}

/**
 * Extension point for custom prompt strategies
 * Implement for meta-prompting and prompt injection protection
 */
export interface PromptStrategy {
  name: string
  transform: (prompt: string, context: Record<string, unknown>) => string
  validate: (prompt: string) => { valid: boolean; reason?: string }
  // Expansion point: Add prompt optimization methods
}
