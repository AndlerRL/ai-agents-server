/**
 * LLM and Tool Management System
 * Provides multi-model LLM handling with tool integration
 * Supports OpenAI, custom providers, and extensible tool system
 */

import { OpenAI } from 'openai'
import { nanoid } from 'nanoid'
import type { 
  LLMModel, 
  LLMConfig, 
  Tool, 
  ToolResult, 
  ToolHandler,
  ChatMessage,
  ChatResponse,
  ModelProvider
} from './types'

// ============================================================================
// LLM Provider Implementations
// ============================================================================

export class OpenAIProvider implements ModelProvider {
  name = 'openai'
  private client: OpenAI

  constructor(config: { apiKey: string; organization?: string; baseURL?: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL
    })
  }

  async initialize(config: Record<string, unknown>): Promise<void> {
    // Test connection
    try {
      await this.client.models.list()
    } catch (error) {
      throw new Error(`Failed to initialize OpenAI provider: ${error}`)
    }
  }

  async chat(messages: ChatMessage[], config: LLMConfig & { model?: string }): Promise<ChatResponse> {
    const startTime = Date.now()

    try {
      const response = await this.client.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
        stop: config.stop
      })

      const processingTime = Date.now() - startTime
      const choice = response.choices[0]

      return {
        message: choice.message.content || '',
        agentId: nanoid(),
        metadata: {
          model: response.model,
          tokensUsed: response.usage?.total_tokens || 0,
          processingTime
        }
      }
    } catch (error) {
      throw new Error(`OpenAI chat completion failed: ${error}`)
    }
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text
      })

      return response.data[0].embedding
    } catch (error) {
      throw new Error(`OpenAI embedding failed: ${error}`)
    }
  }
}

// ============================================================================
// Tool System Implementation
// ============================================================================

export class ToolRegistry {
  private tools = new Map<string, Tool>()
  private categories = new Set<string>()

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
    this.categories.add(tool.category)
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools by category
   */
  getByCategory(category: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.category === category)
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories)
  }

  /**
   * Execute a tool
   */
  async execute(name: string, parameters: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`
      }
    }

    try {
      // Validate parameters (basic validation)
      const validationResult = this.validateParameters(tool, parameters)
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Parameter validation failed: ${validationResult.error}`
        }
      }

      const result = await tool.handler(parameters)
      return {
        ...result,
        metadata: {
          ...result.metadata,
          toolName: name,
          executedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error}`,
        metadata: {
          toolName: name,
          executedAt: new Date().toISOString()
        }
      }
    }
  }

  /**
   * Validate tool parameters
   */
  private validateParameters(
    tool: Tool, 
    parameters: Record<string, unknown>
  ): { valid: boolean; error?: string } {
    const { required = [] } = tool.parameters

    // Check required parameters
    for (const param of required) {
      if (!(param in parameters)) {
        return {
          valid: false,
          error: `Missing required parameter: ${param}`
        }
      }
    }

    // TODO: Add more detailed parameter validation based on schema
    // This is an expansion point for custom validation logic

    return { valid: true }
  }

  /**
   * Get tool schemas for LLM function calling
   */
  getToolSchemas(toolNames?: string[]): any[] {
    const tools = toolNames 
      ? toolNames.map(name => this.tools.get(name)).filter(Boolean) as Tool[]
      : Array.from(this.tools.values())

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }
}

// ============================================================================
// LLM Manager
// ============================================================================

export class LLMManager {
  private providers = new Map<string, ModelProvider>()
  private models = new Map<string, LLMModel>()
  private toolRegistry: ToolRegistry

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry
  }

  /**
   * Register a model provider
   */
  async registerProvider(provider: ModelProvider): Promise<void> {
    await provider.initialize({})
    this.providers.set(provider.name, provider)
  }

  /**
   * Register a model configuration
   */
  registerModel(id: string, model: LLMModel): void {
    this.models.set(id, model)
  }

  /**
   * Get a model by ID
   */
  getModel(id: string): LLMModel | undefined {
    return this.models.get(id)
  }

  /**
   * Get all models
   */
  getAllModels(): LLMModel[] {
    return Array.from(this.models.values())
  }

  /**
   * Chat with a model
   */
  async chat(
    modelId: string,
    messages: ChatMessage[],
    options: {
      tools?: string[]
      config?: Partial<LLMConfig>
    } = {}
  ): Promise<ChatResponse> {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model '${modelId}' not found`)
    }

    const provider = this.providers.get(model.provider)
    if (!provider) {
      throw new Error(`Provider '${model.provider}' not found`)
    }

    const config = { ...model.config, ...options.config }

    // Add tool schemas if tools are requested
    if (options.tools && options.tools.length > 0) {
      // TODO: Implement function calling integration
      // This is an expansion point for tool integration with LLM calls
    }

    return provider.chat(messages, config)
  }

  /**
   * Generate embeddings
   */
  async embed(modelId: string, text: string): Promise<number[]> {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model '${modelId}' not found`)
    }

    const provider = this.providers.get(model.provider)
    if (!provider) {
      throw new Error(`Provider '${model.provider}' not found`)
    }

    return provider.embed(text)
  }

  /**
   * Chat with tool support
   */
  async chatWithTools(
    modelId: string,
    messages: ChatMessage[],
    availableTools: string[] = [],
    config?: Partial<LLMConfig>
  ): Promise<ChatResponse & { toolCalls?: any[] }> {
    // This is an expansion point for implementing function calling
    // Current implementation returns basic chat response
    const response = await this.chat(modelId, messages, { tools: availableTools, config })
    
    return {
      ...response,
      toolCalls: [] // TODO: Parse tool calls from response
    }
  }
}

// ============================================================================
// Built-in Tools
// ============================================================================

/**
 * Text analysis tool
 */
export const textAnalysisTool: Tool = {
  name: 'analyze_text',
  description: 'Analyze text for sentiment, keywords, and statistics',
  category: 'analysis',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to analyze'
      },
      analysis_type: {
        type: 'string',
        description: 'Type of analysis to perform',
        enum: ['sentiment', 'keywords', 'statistics', 'all']
      }
    },
    required: ['text']
  },
  handler: async (params): Promise<ToolResult> => {
    const { text, analysis_type = 'all' } = params as { text: string; analysis_type?: string }
    
    const result: any = {}
    
    if (analysis_type === 'sentiment' || analysis_type === 'all') {
      // Simple sentiment analysis (can be enhanced with ML models)
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful']
      const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing']
      
      const words = text.toLowerCase().split(/\s+/)
      const positiveCount = words.filter(word => positiveWords.includes(word)).length
      const negativeCount = words.filter(word => negativeWords.includes(word)).length
      
      result.sentiment = {
        score: positiveCount - negativeCount,
        positive: positiveCount,
        negative: negativeCount,
        overall: positiveCount > negativeCount ? 'positive' : negativeCount > positiveCount ? 'negative' : 'neutral'
      }
    }
    
    if (analysis_type === 'statistics' || analysis_type === 'all') {
      const words = text.split(/\s+/)
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
      
      result.statistics = {
        characters: text.length,
        words: words.length,
        sentences: sentences.length,
        averageWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0
      }
    }
    
    if (analysis_type === 'keywords' || analysis_type === 'all') {
      // Simple keyword extraction (can be enhanced with NLP libraries)
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
      
      const frequency: Record<string, number> = {}
      words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1
      })
      
      const keywords = Object.entries(frequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }))
      
      result.keywords = keywords
    }
    
    return {
      success: true,
      data: result
    }
  }
}

/**
 * Search tool (placeholder for expansion)
 */
export const searchTool: Tool = {
  name: 'search',
  description: 'Search for information using various sources',
  category: 'search',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      source: {
        type: 'string',
        description: 'Search source',
        enum: ['web', 'memory', 'documents']
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results'
      }
    },
    required: ['query']
  },
  handler: async (params): Promise<ToolResult> => {
    const { query, source = 'memory', limit = 10 } = params as { 
      query: string; 
      source?: string; 
      limit?: number 
    }
    
    // TODO: Implement actual search functionality
    // This is an expansion point for integrating with search APIs, memory stores, etc.
    
    return {
      success: true,
      data: {
        query,
        source,
        results: [
          {
            id: nanoid(),
            title: `Sample result for: ${query}`,
            content: `This is a placeholder result for the search query: ${query}`,
            relevance: 0.9
          }
        ],
        totalResults: 1
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry()
  
  // Register built-in tools
  registry.register(textAnalysisTool)
  registry.register(searchTool)
  
  return registry
}

export function createLLMManager(toolRegistry: ToolRegistry): LLMManager {
  return new LLMManager(toolRegistry)
}

export async function createOpenAIProvider(config: {
  apiKey: string
  organization?: string
  baseURL?: string
}): Promise<OpenAIProvider> {
  const provider = new OpenAIProvider(config)
  await provider.initialize({})
  return provider
}
