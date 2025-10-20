/**
 * Dashboard Routes
 * Provides management interface and statistics for the AI agents server
 */

import { Elysia, t } from 'elysia'
import { dashboardRouteOptions, getDashboardDataHandler } from '~/lib/server/dashboard-data'
import type { Container } from '../core/container'
import type { ServerStateManager } from '../core/state'
import type { WebhookManager } from '../core/webhooks'

export function createDashboardRoutes(app: Elysia) {
  return app
    // Dashboard - HTML UI with real-time statistics
    .get('/', getDashboardDataHandler, dashboardRouteOptions)
  
    // Dashboard alias route
    .get('/dashboard', getDashboardDataHandler, dashboardRouteOptions)

    .get('/agents', (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const agents = state.getAllAgents()
        
        return {
          success: true,
          data: agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            model: agent.model,
            toolCount: agent.tools.length,
            createdAt: agent.createdAt,
            lastActivity: agent.lastActivity
          })),
          summary: {
            total: agents.length,
            active: agents.filter(a => a.status === 'processing').length,
            idle: agents.filter(a => a.status === 'idle').length,
            error: agents.filter(a => a.status === 'error').length
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get agents: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard'],
        summary: 'Agent overview',
        description: 'Get detailed information about all agents'
      }
    })

    .get('/stats', (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const webhooks = (context as any).webhooks as WebhookManager
        const mcpManager = (context as any).mcpManager

        if (!state) {
          console.error('❌ serverState is undefined in dashboard handler')
          return 'Error: Server state not available'
        }
        
        const stateSnapshot = state.getStateSnapshot()
        const webhookStats = webhooks.getStatistics()
        const mcpStats = mcpManager ? mcpManager.getStatistics() : null
        
        const agents = Array.from(stateSnapshot.agents.values())
        
        return {
          success: true,
          data: {
            server: {
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              requests: stateSnapshot.statistics.totalRequests,
              avgResponseTime: stateSnapshot.statistics.averageResponseTime,
              errorRate: stateSnapshot.statistics.errorRate,
              tokensUsed: stateSnapshot.statistics.totalTokensUsed
            },
            agents: {
              total: agents.length,
              byStatus: {
                processing: agents.filter(a => a.status === 'processing').length,
                idle: agents.filter(a => a.status === 'idle').length,
                error: agents.filter(a => a.status === 'error').length
              },
              byProvider: {
                openai: agents.filter(a => a.model.provider === 'openai').length,
                custom: agents.filter(a => a.model.provider === 'custom').length,
                anthropic: agents.filter(a => a.model.provider === 'anthropic').length
              },
              byModel: agents.reduce((acc, agent) => {
                const model = agent.model.model
                acc[model] = (acc[model] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            },
            webhooks: webhookStats,
            mcp: mcpStats || { enabled: false }
          },
          links: {
            openai: '/stats/openai',
            vercel: '/stats/ai',
            mcp: '/stats/mcp'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get statistics: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard'],
        summary: 'Complete server statistics',
        description: 'Get comprehensive statistics including all features (server, agents, webhooks, MCP)'
      }
    })

    .get('/stats/openai', (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const stateSnapshot = state.getStateSnapshot()
        
        const allAgents = Array.from(stateSnapshot.agents.values())
        const openaiAgents = allAgents.filter(a => a.model.provider === 'openai')
        
        return {
          success: true,
          data: {
            enabled: Boolean(process.env.OPENAI_API_KEY),
            agents: {
              total: openaiAgents.length,
              active: openaiAgents.filter(a => a.status === 'processing').length,
              idle: openaiAgents.filter(a => a.status === 'idle').length,
              byModel: openaiAgents.reduce((acc, agent) => {
                const model = agent.model.model
                acc[model] = (acc[model] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            },
            usage: {
              totalTokens: stateSnapshot.statistics.totalTokensUsed,
              avgResponseTime: stateSnapshot.statistics.averageResponseTime,
              totalRequests: openaiAgents.reduce((sum, a) => sum + ((a as any).requestCount || 0), 0)
            },
            models: [...new Set(openaiAgents.map(a => a.model.model))],
            tools: {
              total: [...new Set(openaiAgents.flatMap(a => a.tools.map(t => t.name)))].length,
              byAgent: openaiAgents.map(a => ({
                id: a.id,
                name: a.name,
                tools: a.tools.length
              }))
            }
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get OpenAI statistics: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard', 'OpenAI'],
        summary: 'OpenAI SDK statistics',
        description: 'Get detailed statistics for OpenAI SDK agents and usage'
      }
    })

    .get('/stats/ai', (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const stateSnapshot = state.getStateSnapshot()
        
        const allAgents = Array.from(stateSnapshot.agents.values())
        const customAgents = allAgents.filter(a => a.model.provider === 'custom')
        
        return {
          success: true,
          data: {
            enabled: customAgents.length > 0,
            status: 'Coming Soon',
            agents: {
              total: customAgents.length,
              active: customAgents.filter(a => a.status === 'processing').length,
              idle: customAgents.filter(a => a.status === 'idle').length
            },
            note: 'Vercel AI SDK integration is an expansion point for future development'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get Vercel AI statistics: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard', 'Vercel AI'],
        summary: 'Vercel AI SDK statistics',
        description: 'Get statistics for Vercel AI SDK agents (coming soon)'
      }
    })

    .get('/stats/mcp', (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const mcpManager = (context as any).mcpManager
        
        if (!mcpManager) {
          return {
            success: false,
            error: 'MCP system not enabled'
          }
        }
        
        const mcpStats = mcpManager.getStatistics()
        const stateSnapshot = state.getStateSnapshot()
        const allAgents = Array.from(stateSnapshot.agents.values())
        const mcpAgents = allAgents.filter(a => (a as any).mcpServers?.length > 0)
        
        return {
          success: true,
          data: {
            enabled: true,
            servers: {
              total: mcpStats.totalServers,
              active: mcpStats.activeServers,
              ready: mcpStats.readyServers,
              error: mcpStats.errorServers,
              byStatus: mcpStats.serversByStatus
            },
            tools: {
              total: mcpStats.totalTools,
              executed: mcpStats.toolExecutions,
              avgExecutionTime: mcpStats.avgToolExecutionTime,
              errorRate: mcpStats.toolErrorRate
            },
            agents: {
              total: mcpAgents.length,
              withMCP: mcpAgents.length,
              avgServersPerAgent: mcpAgents.length > 0 
                ? mcpAgents.reduce((sum, a) => sum + ((a as any).mcpServers?.length || 0), 0) / mcpAgents.length 
                : 0
            },
            performance: {
              avgConnectionTime: mcpStats.avgConnectionTime,
              totalRestarts: mcpStats.totalRestarts,
              uptime: mcpStats.uptime
            }
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get MCP statistics: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard', 'MCP'],
        summary: 'MCP system statistics',
        description: 'Get detailed statistics for MCP servers, tools, and MCP-enabled agents'
      }
    })

    .get('/logs', async (context) => {
      try {
        const { query } = context
        const webhooks = (context as any).webhooks as WebhookManager
        
        const limit = parseInt(query.limit as string) || 100
        const level = query.level as string
        
        // Get recent events as logs
        const events = webhooks.getRecentEvents(limit)
        
        const logs = events
          .filter(event => !level || event.type.includes(level))
          .map(event => ({
            id: event.id,
            timestamp: event.timestamp,
            level: event.type.includes('error') ? 'error' : 
                   event.type.includes('processing') ? 'info' : 'debug',
            message: `${event.type}: ${JSON.stringify(event.payload)}`,
            source: event.source,
            context: event.payload
          }))
        
        return {
          success: true,
          data: logs,
          meta: {
            count: logs.length,
            limit,
            level: level || 'all'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get logs: ${error}`
        }
      }
    }, {
      query: t.Object({
        limit: t.Optional(t.String()),
        level: t.Optional(t.String())
      }),
      detail: {
        tags: ['Dashboard'],
        summary: 'Server logs',
        description: 'Get recent server logs and events'
      }
    })

    .get('/memory', async (context) => {
      try {
        const container = (context as any).container as Container
        const state = (context as any).state as ServerStateManager
        
        const memoryStore = await container.resolve('memoryStore') as any
        const stateSnapshot = state.getStateSnapshot()
        
        // Get memory statistics
        let memoryStats = {
          entries: 0,
          size: 0,
          types: {} as Record<string, number>
        }
        
        if (memoryStore.size) {
          memoryStats.entries = memoryStore.size()
          
          // If it's an enhanced memory store, get chunking stats
          if (memoryStore.getChunkingStats) {
            const chunkingStats = memoryStore.getChunkingStats()
            memoryStats = {
              ...memoryStats,
              ...chunkingStats
            }
          }
        }
        
        return {
          success: true,
          data: {
            memory: memoryStats,
            serverMemory: stateSnapshot.statistics.memoryUsage,
            processMemory: process.memoryUsage()
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get memory statistics: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard'],
        summary: 'Memory statistics',
        description: 'Get memory usage and storage statistics'
      }
    })

    .get('/tools', async (context) => {
      try {
        const container = (context as any).container as Container
        const toolRegistry = await container.resolve('toolRegistry') as any
        
        const tools = toolRegistry.getAll()
        const categories = toolRegistry.getCategories()
        
        return {
          success: true,
          data: {
            tools: tools.map((tool: any) => ({
              name: tool.name,
              description: tool.description,
              category: tool.category,
              parameterCount: Object.keys(tool.parameters.properties || {}).length
            })),
            categories,
            summary: {
              total: tools.length,
              byCategory: categories.reduce((acc: Record<string, number>, cat: string) => {
                acc[cat] = toolRegistry.getByCategory(cat).length
                return acc
              }, {})
            }
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get tool information: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard'],
        summary: 'Tool overview',
        description: 'Get information about available tools and categories'
      }
    })

    .post('/actions/cleanup', async (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const webhooks = (context as any).webhooks as WebhookManager
        
        // Clean up inactive agents (older than 1 hour)
        const agents = state.getAllAgents()
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        let cleaned = 0
        
        for (const agent of agents) {
          if (agent.lastActivity < oneHourAgo && agent.status === 'idle') {
            state.deleteAgent(agent.id)
            cleaned++
          }
        }
        
        // Broadcast cleanup event
        await webhooks.broadcast({
          type: 'agent.error', // Using error type for cleanup
          payload: { action: 'cleanup', agentsRemoved: cleaned },
          source: 'dashboard'
        })
        
        return {
          success: true,
          message: `Cleanup completed. Removed ${cleaned} inactive agents.`,
          data: { agentsRemoved: cleaned }
        }
      } catch (error) {
        return {
          success: false,
          error: `Cleanup failed: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard'],
        summary: 'Cleanup inactive agents',
        description: 'Remove inactive agents to free up resources'
      }
    })

    .post('/actions/restart', async (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const webhooks = (context as any).webhooks as WebhookManager
        
        // This is a placeholder for restart functionality
        // In a real implementation, this would gracefully restart services
        
        await webhooks.broadcast({
          type: 'agent.error', // Using error type for system events
          payload: { action: 'restart_requested' },
          source: 'dashboard'
        })
        
        return {
          success: true,
          message: 'Restart request logged. Manual restart required.',
          note: 'This is a placeholder. Implement actual restart logic as needed.'
        }
      } catch (error) {
        return {
          success: false,
          error: `Restart request failed: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard'],
        summary: 'Request server restart',
        description: 'Request a server restart (placeholder implementation)'
      }
    })
}
