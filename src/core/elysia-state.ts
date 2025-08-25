/**
 * Elysia State Plugin
 * Properly integrates with Elysia's built-in state management system
 * Using .state(), .decorate(), and .derive() as per Elysia documentation
 */

import { Elysia } from 'elysia'
import { createServerStateManager } from './state'
import { createWebhookManager } from './webhooks'
import { createMemoryStore } from './memory'
import { createToolRegistry, createLLMManager, createOpenAIProvider } from './llm'
import type { ServerConfig } from './types'

// ============================================================================
// Main AI Agents State Plugin - Complete state management solution
// ============================================================================

export const createAIAgentsState = (config: ServerConfig) => new Elysia({
  name: 'ai-agents-server-state'
})
  // Set up global state using Elysia's state system
  .state({
    // Server statistics
    totalRequests: 0,
    activeAgents: 0,
    totalTokensUsed: 0,
    averageResponseTime: 0,
    errorRate: 0,
    
    // Connection tracking
    activeConnections: 0,
    webhookSubscriptions: 0,
    
    // Performance metrics
    startTime: Date.now(),
    lastHealthCheck: new Date(),
    
    // Feature flags
    openaiEnabled: !!config.openai.apiKey,
    debugMode: config.environment === 'development'
  })
  // Initialize core services and add them to derived context
  .derive({ as: 'global' }, async () => {
    console.log('🔧 Initializing AI Agents Server core services...')

    // Create core services
    const memoryStore = createMemoryStore('enhanced', config.chunking)
    const serverState = createServerStateManager(memoryStore)
    const webhookManager = createWebhookManager({
      maxConnections: 1000,
      messageBufferSize: 100,
      heartbeatInterval: 30000,
      enablePersistence: true
    })
    const toolRegistry = createToolRegistry()
    const llmManager = createLLMManager(toolRegistry)

    // Initialize OpenAI provider if configured
    if (config.openai.apiKey) {
      try {
        const openaiProvider = await createOpenAIProvider(config.openai)
        await llmManager.registerProvider(openaiProvider)
        
        // Register default OpenAI models
        llmManager.registerModel('gpt-4o-mini', {
          provider: 'openai',
          model: 'gpt-4o-mini',
          config: {
            temperature: 0.7,
            maxTokens: 4096
          }
        })

        llmManager.registerModel('gpt-4o', {
          provider: 'openai',
          model: 'gpt-4o',
          config: {
            temperature: 0.7,
            maxTokens: 8192
          }
        })

        console.log('✅ OpenAI provider initialized successfully')
      } catch (error) {
        console.warn('⚠️  Failed to initialize OpenAI provider:', error)
      }
    } else {
      console.warn('⚠️  No OpenAI API key provided, OpenAI features will be disabled')
    }

    return {
      // Core services
      serverState,
      webhookManager,
      memoryStore,
      toolRegistry,
      llmManager,
      
      // Agent management functions
      createAgent: async (agentData: any) => {
        const agent = {
          id: `agent_${Date.now()}`,
          ...agentData,
          status: 'idle' as const,
          createdAt: new Date(),
          lastActivity: new Date()
        }
        
        serverState.createAgent(agent)
        return agent
      },
      
      deleteAgent: async (agentId: string) => {
        return serverState.deleteAgent(agentId)
      },
      
      updateAgentStatus: (agentId: string, status: string) => {
        return serverState.updateAgent(agentId, { 
          status: status as any,
          lastActivity: new Date()
        })
      },
      
      getAgent: (agentId: string) => {
        return serverState.getAgent(agentId)
      },
      
      getAllAgents: () => {
        return serverState.getAllAgents()
      },
      
      // WebSocket management functions
      addWebSocketConnection: (ws: WebSocket, clientId?: string) => {
        return webhookManager.subscribe(ws, [], { clientId })
      },
      
      removeWebSocketConnection: (subscriptionId: string) => {
        return webhookManager.unsubscribe(subscriptionId)
      },
      
      broadcastEvent: async (eventType: string, payload: any, source = 'server') => {
        await webhookManager.broadcast({
          type: eventType as any,
          payload,
          source
        })
      },
      
      // LLM operations
      chatWithAgent: async (modelId: string, messages: any[], options: any = {}) => {
        await webhookManager.broadcast({
          type: 'agent.processing',
          payload: { modelId, messageCount: messages.length },
          source: 'llm'
        })
        
        try {
          const response = await llmManager.chat(modelId, messages, options)
          
          await webhookManager.broadcast({
            type: 'agent.completed',
            payload: {
              modelId,
              tokensUsed: response.metadata.tokensUsed,
              processingTime: response.metadata.processingTime
            },
            source: 'llm'
          })
          
          return response
        } catch (error) {
          await webhookManager.broadcast({
            type: 'agent.error',
            payload: { modelId, error: String(error) },
            source: 'llm'
          })
          throw error
        }
      },
      
      executeAgentTool: async (toolName: string, parameters: any) => {
        try {
          const result = await toolRegistry.execute(toolName, parameters)
          
          await webhookManager.broadcast({
            type: 'tool.executed',
            payload: {
              toolName,
              success: result.success,
              data: result.data
            },
            source: 'tools'
          })
          
          return result
        } catch (error) {
          await webhookManager.broadcast({
            type: 'tool.executed',
            payload: {
              toolName,
              success: false,
              error: String(error)
            },
            source: 'tools'
          })
          throw error
        }
      },
      
      getAvailableModels: () => {
        return llmManager.getAllModels()
      },
      
      getAvailableTools: () => {
        return toolRegistry.getAll()
      }
    }
  })
  // Add convenience decorator functions for state management
  .derive(({ store }) => ({
    // State management helpers
    incrementRequests: () => {
      (store as any).totalRequests++
      ;(store as any).lastHealthCheck = new Date()
    },
    
    addTokenUsage: (tokens: number) => {
      ;(store as any).totalTokensUsed += tokens
    },
    
    updateResponseTime: (newTime: number) => {
      const state = store as any
      const { totalRequests, averageResponseTime } = state
      const newAverage = totalRequests === 0 
        ? newTime 
        : (averageResponseTime * (totalRequests - 1) + newTime) / totalRequests
      state.averageResponseTime = newAverage
    },
    
    updateErrorRate: (hasError: boolean) => {
      const state = store as any
      const currentErrors = state.errorRate * state.totalRequests
      const newErrors = currentErrors + (hasError ? 1 : 0)
      state.errorRate = state.totalRequests > 0 ? newErrors / state.totalRequests : 0
    },
    
    incrementAgents: () => {
      ;(store as any).activeAgents++
    },
    
    decrementAgents: () => {
      ;(store as any).activeAgents--
    },
    
    incrementConnections: () => {
      ;(store as any).activeConnections++
    },
    
    decrementConnections: () => {
      ;(store as any).activeConnections--
    },
    
    incrementSubscriptions: () => {
      ;(store as any).webhookSubscriptions++
    },
    
    decrementSubscriptions: () => {
      ;(store as any).webhookSubscriptions--
    },
    
    // Health status function
    getHealthStatus: () => {
      const state = store as any
      const uptime = (Date.now() - state.startTime) / 1000
      const memoryUsage = process.memoryUsage()
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      
      if (state.errorRate > 0.1 || memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) {
        status = 'unhealthy'
      } else if (state.errorRate > 0.05 || memoryUsage.heapUsed / memoryUsage.heapTotal > 0.75) {
        status = 'degraded'
      }
      
      return {
        status,
        uptime,
        memory: memoryUsage,
        agents: state.activeAgents,
        connections: state.activeConnections,
        requests: state.totalRequests,
        tokensUsed: state.totalTokensUsed,
        averageResponseTime: state.averageResponseTime,
        errorRate: state.errorRate,
        lastHealthCheck: state.lastHealthCheck
      }
    },
    
    // Server statistics summary
    getServerStats: () => {
      const state = store as any
      return {
        requests: state.totalRequests,
        agents: state.activeAgents,
        connections: state.activeConnections,
        tokensUsed: state.totalTokensUsed,
        averageResponseTime: state.averageResponseTime,
        errorRate: state.errorRate,
        uptime: (Date.now() - state.startTime) / 1000,
        features: {
          openaiEnabled: state.openaiEnabled,
          debugMode: state.debugMode
        }
      }
    }
  }))
  // Add request tracking middleware
  .onBeforeHandle(({ incrementRequests }) => {
    incrementRequests()
  })
  .onAfterHandle(({ updateResponseTime }) => {
    // In a real implementation, you'd measure actual response time
    const responseTime = 50 // Placeholder
    updateResponseTime(responseTime)
  })
  .onError(({ updateErrorRate, error }) => {
    if (updateErrorRate) {
      updateErrorRate(true)
    }
    console.error('Request error:', error)
  })


