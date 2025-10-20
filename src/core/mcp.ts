/**
 * Model Context Protocol (MCP) Manager
 * Manages MCP server lifecycle, tool execution, and agent integration
 * Supports both OpenAI and Vercel AI SDK agents
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { EventEmitter } from 'eventemitter3'
import { nanoid } from 'nanoid'
import type {
  MCPServerConfig,
  MCPServerInstance,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPToolCall,
  MCPToolResponse,
  MCPPromptCall,
  MCPPromptResponse,
  MCPResourceRequest,
  MCPResourceResponse,
  MCPEvent,
  MCPStatistics,
  MCPAgentConfig
} from './mcp-types'
import type { AgentInstance, ToolResult } from './types'

interface MCPManagerEvents {
  'server:started': (serverId: string) => void
  'server:stopped': (serverId: string) => void
  'server:error': (serverId: string, error: Error) => void
  'tool:executed': (toolCall: MCPToolCall, result: MCPToolResponse) => void
  'agent:created': (agentId: string, mcpServers: string[]) => void
}

export class MCPManager extends EventEmitter<MCPManagerEvents> {
  private servers = new Map<string, MCPServerInstance>()
  private clients = new Map<string, Client>()
  private transports = new Map<string, StdioClientTransport>()
  private agentMCPMap = new Map<string, string[]>() // agentId -> serverIds[]
  private toolExecutionTimes: number[] = []

  constructor() {
    super()
  }

  // ============================================================================
  // MCP Server Management
  // ============================================================================

  /**
   * Start an MCP server
   */
  async startServer(config: MCPServerConfig): Promise<MCPServerInstance> {
    // Check if server already exists
    if (this.servers.has(config.id)) {
      throw new Error(`MCP server ${config.id} already exists`)
    }

    const instance: MCPServerInstance = {
      id: config.id,
      config,
      status: 'starting',
      tools: [],
      prompts: [],
      resources: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      restartCount: 0
    }

    this.servers.set(config.id, instance)

    try {
      // Create client and transport
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env
      })

      const client = new Client(
        {
          name: 'ai-agents-server',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      )

      // Store transport and client
      this.transports.set(config.id, transport)
      this.clients.set(config.id, client)

      // Connect to server
      await client.connect(transport)

      // Get server capabilities
      const toolsList = await client.listTools()
      const promptsList = await client.listPrompts()
      const resourcesList = await client.listResources()

      // Update instance with tools, prompts, and resources
      instance.tools = toolsList.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as any,
        serverId: config.id
      }))

      instance.prompts = promptsList.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description || '',
        arguments: prompt.arguments?.map(arg => ({
          name: arg.name,
          description: arg.description || '',
          required: arg.required || false
        })),
        serverId: config.id
      }))

      instance.resources = resourcesList.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description || '',
        mimeType: resource.mimeType,
        serverId: config.id
      }))

      instance.status = 'ready'
      instance.lastActivity = new Date()

      this.emit('server:started', config.id)

      return instance
    } catch (error) {
      instance.status = 'error'
      instance.error = String(error)
      
      // Auto-restart if configured
      if (config.autoRestart && (!config.maxRestarts || (instance.restartCount || 0) < config.maxRestarts)) {
        instance.restartCount = (instance.restartCount || 0) + 1
        console.log(`Auto-restarting MCP server ${config.id} (attempt ${instance.restartCount})`)
        
        // Clean up failed attempt
        this.clients.delete(config.id)
        this.transports.delete(config.id)
        
        // Retry after delay
        setTimeout(() => {
          this.startServer(config).catch(err => {
            console.error(`Failed to restart MCP server ${config.id}:`, err)
          })
        }, 5000)
      }

      this.emit('server:error', config.id, error as Error)
      throw new Error(`Failed to start MCP server ${config.id}: ${error}`)
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverId: string): Promise<boolean> {
    const instance = this.servers.get(serverId)
    if (!instance) {
      return false
    }

    try {
      const client = this.clients.get(serverId)
      const transport = this.transports.get(serverId)

      if (client) {
        await client.close()
        this.clients.delete(serverId)
      }

      if (transport) {
        await transport.close()
        this.transports.delete(serverId)
      }

      instance.status = 'stopped'
      instance.lastActivity = new Date()

      this.emit('server:stopped', serverId)
      return true
    } catch (error) {
      console.error(`Error stopping MCP server ${serverId}:`, error)
      return false
    }
  }

  /**
   * Restart an MCP server
   */
  async restartServer(serverId: string): Promise<MCPServerInstance> {
    const instance = this.servers.get(serverId)
    if (!instance) {
      throw new Error(`MCP server ${serverId} not found`)
    }

    await this.stopServer(serverId)
    this.servers.delete(serverId)

    return this.startServer(instance.config)
  }

  /**
   * Get an MCP server instance
   */
  getServer(serverId: string): MCPServerInstance | undefined {
    return this.servers.get(serverId)
  }

  /**
   * Get all MCP servers
   */
  getAllServers(): MCPServerInstance[] {
    return Array.from(this.servers.values())
  }

  /**
   * Get servers by status
   */
  getServersByStatus(status: MCPServerInstance['status']): MCPServerInstance[] {
    return Array.from(this.servers.values()).filter(s => s.status === status)
  }

  // ============================================================================
  // Tool Execution
  // ============================================================================

  /**
   * Execute an MCP tool
   */
  async executeTool(toolCall: MCPToolCall): Promise<MCPToolResponse> {
    const startTime = Date.now()
    const server = this.servers.get(toolCall.serverId)
    
    if (!server) {
      throw new Error(`MCP server ${toolCall.serverId} not found`)
    }

    if (server.status !== 'ready') {
      throw new Error(`MCP server ${toolCall.serverId} is not ready (status: ${server.status})`)
    }

    const client = this.clients.get(toolCall.serverId)
    if (!client) {
      throw new Error(`MCP client for server ${toolCall.serverId} not found`)
    }

    try {
      // Execute tool using MCP SDK
      const result = await client.callTool({
        name: toolCall.tool,
        arguments: toolCall.parameters
      })

      const executionTime = Date.now() - startTime
      this.toolExecutionTimes.push(executionTime)

      // Keep only last 100 execution times
      if (this.toolExecutionTimes.length > 100) {
        this.toolExecutionTimes.shift()
      }

      const response: MCPToolResponse = {
        callId: toolCall.callId,
        result: {
          success: !result.isError,
          data: result.content,
          error: result.isError ? 'Tool execution failed' : undefined
        },
        executionTime,
        serverId: toolCall.serverId,
        timestamp: new Date()
      }

      // Update server activity
      server.lastActivity = new Date()

      this.emit('tool:executed', toolCall, response)

      return response
    } catch (error) {
      const executionTime = Date.now() - startTime
      
      throw new Error(`Failed to execute tool ${toolCall.tool}: ${error}`)
    }
  }

  /**
   * Get available tools from a server
   */
  getServerTools(serverId: string): MCPTool[] {
    const server = this.servers.get(serverId)
    return server?.tools || []
  }

  /**
   * Get all available tools from all servers
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.servers.values()).flatMap(server => server.tools)
  }

  // ============================================================================
  // Prompt Execution
  // ============================================================================

  /**
   * Execute an MCP prompt
   */
  async executePrompt(promptCall: MCPPromptCall): Promise<MCPPromptResponse> {
    const server = this.servers.get(promptCall.serverId)
    
    if (!server) {
      throw new Error(`MCP server ${promptCall.serverId} not found`)
    }

    if (server.status !== 'ready') {
      throw new Error(`MCP server ${promptCall.serverId} is not ready`)
    }

    const client = this.clients.get(promptCall.serverId)
    if (!client) {
      throw new Error(`MCP client for server ${promptCall.serverId} not found`)
    }

    try {
      const result = await client.getPrompt({
        name: promptCall.prompt,
        arguments: promptCall.arguments as Record<string, string>
      })

      server.lastActivity = new Date()

      return {
        messages: result.messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: typeof msg.content === 'string' 
            ? msg.content 
            : msg.content.type === 'text' 
              ? msg.content.text 
              : JSON.stringify(msg.content)
        })),
        serverId: promptCall.serverId,
        timestamp: new Date()
      }
    } catch (error) {
      throw new Error(`Failed to execute prompt ${promptCall.prompt}: ${error}`)
    }
  }

  /**
   * Get available prompts from a server
   */
  getServerPrompts(serverId: string): MCPPrompt[] {
    const server = this.servers.get(serverId)
    return server?.prompts || []
  }

  /**
   * Get all available prompts from all servers
   */
  getAllPrompts(): MCPPrompt[] {
    return Array.from(this.servers.values()).flatMap(server => server.prompts)
  }

  // ============================================================================
  // Resource Access
  // ============================================================================

  /**
   * Access an MCP resource
   */
  async accessResource(request: MCPResourceRequest): Promise<MCPResourceResponse> {
    const server = this.servers.get(request.serverId)
    
    if (!server) {
      throw new Error(`MCP server ${request.serverId} not found`)
    }

    if (server.status !== 'ready') {
      throw new Error(`MCP server ${request.serverId} is not ready`)
    }

    const client = this.clients.get(request.serverId)
    if (!client) {
      throw new Error(`MCP client for server ${request.serverId} not found`)
    }

    try {
      const result = await client.readResource({
        uri: request.uri
      })

      server.lastActivity = new Date()

      return {
        content: typeof result.contents[0].text === 'string' 
          ? result.contents[0].text 
          : JSON.stringify(result.contents[0]),
        mimeType: result.contents[0].mimeType || 'text/plain',
        serverId: request.serverId,
        timestamp: new Date()
      }
    } catch (error) {
      throw new Error(`Failed to access resource ${request.uri}: ${error}`)
    }
  }

  /**
   * Get available resources from a server
   */
  getServerResources(serverId: string): MCPResource[] {
    const server = this.servers.get(serverId)
    return server?.resources || []
  }

  /**
   * Get all available resources from all servers
   */
  getAllResources(): MCPResource[] {
    return Array.from(this.servers.values()).flatMap(server => server.resources)
  }

  // ============================================================================
  // Agent-MCP Integration
  // ============================================================================

  /**
   * Create an agent with MCP server support
   */
  async createMCPAgent(config: MCPAgentConfig): Promise<AgentInstance> {
    const agentId = nanoid()
    
    // Validate MCP servers exist and are ready
    for (const serverId of config.mcpServers) {
      const server = this.servers.get(serverId)
      if (!server) {
        throw new Error(`MCP server ${serverId} not found`)
      }
      if (server.status !== 'ready') {
        throw new Error(`MCP server ${serverId} is not ready`)
      }
    }

    // Store agent-MCP mapping
    this.agentMCPMap.set(agentId, config.mcpServers)

    // Create agent instance
    const agent: AgentInstance = {
      id: agentId,
      ...config.agent,
      createdAt: new Date(),
      lastActivity: new Date()
    }

    // Auto-import MCP tools if configured
    if (config.autoImportTools) {
      const mcpTools = config.mcpServers.flatMap(serverId => 
        this.getServerTools(serverId)
      )

      // Convert MCP tools to agent tools
      agent.tools = [
        ...agent.tools,
        ...mcpTools.map(mcpTool => ({
          name: config.toolPrefix ? `${config.toolPrefix}${mcpTool.name}` : mcpTool.name,
          description: mcpTool.description,
          parameters: mcpTool.inputSchema,
          handler: async (parameters: Record<string, unknown>) => {
            const toolCall: MCPToolCall = {
              tool: mcpTool.name,
              parameters,
              serverId: mcpTool.serverId,
              agentId,
              callId: nanoid()
            }
            const response = await this.executeTool(toolCall)
            return response.result
          },
          category: 'custom' as const
        }))
      ]
    }

    this.emit('agent:created', agentId, config.mcpServers)

    return agent
  }

  /**
   * Get MCP servers for an agent
   */
  getAgentMCPServers(agentId: string): string[] {
    return this.agentMCPMap.get(agentId) || []
  }

  /**
   * Add MCP server to agent
   */
  addServerToAgent(agentId: string, serverId: string): void {
    const servers = this.agentMCPMap.get(agentId) || []
    if (!servers.includes(serverId)) {
      servers.push(serverId)
      this.agentMCPMap.set(agentId, servers)
    }
  }

  /**
   * Remove MCP server from agent
   */
  removeServerFromAgent(agentId: string, serverId: string): void {
    const servers = this.agentMCPMap.get(agentId) || []
    const filtered = servers.filter(id => id !== serverId)
    this.agentMCPMap.set(agentId, filtered)
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get MCP statistics
   */
  getStatistics(): MCPStatistics {
    const servers = Array.from(this.servers.values())
    
    return {
      totalServers: servers.length,
      activeServers: servers.filter(s => s.status === 'ready').length,
      failedServers: servers.filter(s => s.status === 'error').length,
      totalTools: this.getAllTools().length,
      totalPrompts: this.getAllPrompts().length,
      totalResources: this.getAllResources().length,
      totalToolCalls: this.toolExecutionTimes.length,
      totalMCPAgents: this.agentMCPMap.size,
      averageToolExecutionTime: this.toolExecutionTimes.length > 0
        ? this.toolExecutionTimes.reduce((a, b) => a + b, 0) / this.toolExecutionTimes.length
        : 0
    }
  }

  /**
   * Dispose and cleanup all servers
   */
  async dispose(): Promise<void> {
    for (const serverId of this.servers.keys()) {
      await this.stopServer(serverId)
    }

    this.servers.clear()
    this.clients.clear()
    this.transports.clear()
    this.agentMCPMap.clear()
    this.toolExecutionTimes = []
    this.removeAllListeners()
  }
}

// Factory function
export function createMCPManager(): MCPManager {
  return new MCPManager()
}
