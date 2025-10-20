/**
 * Model Context Protocol (MCP) Type Definitions
 * Provides type safety for MCP server integration
 * Supports both OpenAI and Vercel AI SDK agents with MCP servers
 */

import type { AgentInstance, ToolResult } from './types'

// ============================================================================
// MCP Server Configuration
// ============================================================================

export interface MCPServerConfig {
  /** Unique identifier for the MCP server */
  id: string
  
  /** Display name of the MCP server */
  name: string
  
  /** Description of what the MCP server provides */
  description: string
  
  /** Command to execute the MCP server */
  command: string
  
  /** Command-line arguments */
  args: string[]
  
  /** Environment variables for the server process */
  env?: Record<string, string>
  
  /** Server capabilities */
  capabilities?: MCPCapabilities
  
  /** Server transport type */
  transport?: 'stdio' | 'sse' | 'websocket'
  
  /** Connection timeout in milliseconds */
  timeout?: number
  
  /** Auto-restart on failure */
  autoRestart?: boolean
  
  /** Maximum restart attempts */
  maxRestarts?: number
}

export interface MCPCapabilities {
  /** Server supports tool/function calls */
  tools?: boolean
  
  /** Server supports prompts */
  prompts?: boolean
  
  /** Server supports resources */
  resources?: boolean
  
  /** Server supports sampling */
  sampling?: boolean
  
  /** Server supports logging */
  logging?: boolean
}

// ============================================================================
// MCP Server Instance
// ============================================================================

export interface MCPServerInstance {
  /** Unique identifier */
  id: string
  
  /** Configuration used to create this instance */
  config: MCPServerConfig
  
  /** Current status of the server */
  status: 'starting' | 'ready' | 'error' | 'stopped'
  
  /** Available tools from the MCP server */
  tools: MCPTool[]
  
  /** Available prompts from the MCP server */
  prompts: MCPPrompt[]
  
  /** Available resources from the MCP server */
  resources: MCPResource[]
  
  /** Creation timestamp */
  createdAt: Date
  
  /** Last activity timestamp */
  lastActivity: Date
  
  /** Error message if status is 'error' */
  error?: string
  
  /** Process ID (if using stdio transport) */
  pid?: number
  
  /** Number of restart attempts */
  restartCount?: number
}

// ============================================================================
// MCP Tools
// ============================================================================

export interface MCPTool {
  /** Tool name (unique identifier) */
  name: string
  
  /** Human-readable description */
  description: string
  
  /** JSON Schema for input parameters */
  inputSchema: MCPToolInputSchema
  
  /** Server ID that provides this tool */
  serverId: string
}

export interface MCPToolInputSchema {
  type: 'object'
  properties: Record<string, MCPToolParameter>
  required?: string[]
}

export interface MCPToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: MCPToolParameter
  properties?: Record<string, MCPToolParameter>
}

// ============================================================================
// MCP Prompts
// ============================================================================

export interface MCPPrompt {
  /** Prompt name (unique identifier) */
  name: string
  
  /** Human-readable description */
  description: string
  
  /** Prompt arguments */
  arguments?: MCPPromptArgument[]
  
  /** Server ID that provides this prompt */
  serverId: string
}

export interface MCPPromptArgument {
  name: string
  description: string
  required: boolean
}

// ============================================================================
// MCP Resources
// ============================================================================

export interface MCPResource {
  /** Resource URI */
  uri: string
  
  /** Resource name */
  name: string
  
  /** Human-readable description */
  description: string
  
  /** MIME type of the resource */
  mimeType?: string
  
  /** Server ID that provides this resource */
  serverId: string
}

// ============================================================================
// MCP Agent Configuration
// ============================================================================

/**
 * Extended agent configuration with MCP server support
 */
export interface MCPAgentConfig {
  /** Base agent configuration */
  agent: Omit<AgentInstance, 'id' | 'createdAt' | 'lastActivity'>
  
  /** MCP servers to attach to this agent */
  mcpServers: string[] // MCP server IDs
  
  /** SDK type for this agent */
  sdkType: 'openai' | 'vercel'
  
  /** Auto-import MCP tools as agent tools */
  autoImportTools?: boolean
  
  /** Tool name prefix for MCP tools */
  toolPrefix?: string
}

// ============================================================================
// MCP Tool Execution
// ============================================================================

export interface MCPToolCall {
  /** Tool name */
  tool: string
  
  /** Input parameters */
  parameters: Record<string, unknown>
  
  /** MCP server ID */
  serverId: string
  
  /** Agent ID making the call */
  agentId: string
  
  /** Unique call ID */
  callId: string
}

export interface MCPToolResponse {
  /** Call ID */
  callId: string
  
  /** Execution result */
  result: ToolResult
  
  /** Execution time in milliseconds */
  executionTime: number
  
  /** Server that executed the tool */
  serverId: string
  
  /** Timestamp */
  timestamp: Date
}

// ============================================================================
// MCP Prompt Execution
// ============================================================================

export interface MCPPromptCall {
  /** Prompt name */
  prompt: string
  
  /** Prompt arguments */
  arguments: Record<string, unknown>
  
  /** MCP server ID */
  serverId: string
  
  /** Agent ID making the call */
  agentId?: string
}

export interface MCPPromptResponse {
  /** Prompt messages */
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  
  /** Server that executed the prompt */
  serverId: string
  
  /** Timestamp */
  timestamp: Date
}

// ============================================================================
// MCP Resource Access
// ============================================================================

export interface MCPResourceRequest {
  /** Resource URI */
  uri: string
  
  /** MCP server ID */
  serverId: string
  
  /** Agent ID requesting the resource */
  agentId?: string
}

export interface MCPResourceResponse {
  /** Resource content */
  content: string | Buffer
  
  /** MIME type */
  mimeType: string
  
  /** Server that provided the resource */
  serverId: string
  
  /** Timestamp */
  timestamp: Date
}

// ============================================================================
// MCP Events
// ============================================================================

export type MCPEventType =
  | 'mcp.server.started'
  | 'mcp.server.stopped'
  | 'mcp.server.error'
  | 'mcp.server.restarted'
  | 'mcp.tool.called'
  | 'mcp.tool.completed'
  | 'mcp.tool.error'
  | 'mcp.prompt.called'
  | 'mcp.prompt.completed'
  | 'mcp.resource.accessed'
  | 'mcp.agent.created'
  | 'mcp.agent.updated'

export interface MCPEvent {
  type: MCPEventType
  payload: Record<string, unknown>
  serverId?: string
  agentId?: string
  timestamp: Date
}

// ============================================================================
// MCP Statistics
// ============================================================================

export interface MCPStatistics {
  /** Total MCP servers running */
  totalServers: number
  
  /** Active server count */
  activeServers: number
  
  /** Failed server count */
  failedServers: number
  
  /** Total tools available */
  totalTools: number
  
  /** Total prompts available */
  totalPrompts: number
  
  /** Total resources available */
  totalResources: number
  
  /** Total tool calls executed */
  totalToolCalls: number
  
  /** Total agents with MCP servers */
  totalMCPAgents: number
  
  /** Average tool execution time */
  averageToolExecutionTime: number
}
