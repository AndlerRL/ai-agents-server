/**
 * Dashboard Routes
 * Provides management interface and statistics for the AI agents server
 */

import { Elysia, t } from 'elysia'
import type { ServerStateManager } from '../core/state'
import type { WebhookManager } from '../core/webhooks'
import type { Container } from '../core/container'

export function createDashboardRoutes(app: Elysia) {
  return app
    .get('/', (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const webhooks = (context as any).webhooks as WebhookManager
        
        const serverHealth = state.getHealthCheck()
        const webhookStats = webhooks.getStatistics()
        const stateSnapshot = state.getStateSnapshot()
        
        return {
          title: 'AI Agents Server Dashboard',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          health: serverHealth,
          statistics: {
            server: stateSnapshot.statistics,
            webhooks: webhookStats
          },
          agents: {
            total: stateSnapshot.agents.size,
            active: Array.from(stateSnapshot.agents.values())
              .filter(agent => agent.status === 'processing').length,
            idle: Array.from(stateSnapshot.agents.values())
              .filter(agent => agent.status === 'idle').length
          },
          connections: {
            websockets: stateSnapshot.activeConnections.size,
            webhookSubscriptions: webhookStats.totalSubscriptions
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get dashboard data: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Dashboard'],
        summary: 'Main dashboard',
        description: 'Get comprehensive server statistics and health information'
      }
    })

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

    .get('/statistics', (context) => {
      try {
        const state = (context as any).state as ServerStateManager
        const webhooks = (context as any).webhooks as WebhookManager
        
        const stateSnapshot = state.getStateSnapshot()
        const webhookStats = webhooks.getStatistics()
        
        return {
          success: true,
          data: {
            server: {
              ...stateSnapshot.statistics,
              uptime: process.uptime(),
              memory: process.memoryUsage()
            },
            webhooks: webhookStats,
            agents: {
              total: stateSnapshot.agents.size,
              byStatus: {
                processing: Array.from(stateSnapshot.agents.values())
                  .filter(a => a.status === 'processing').length,
                idle: Array.from(stateSnapshot.agents.values())
                  .filter(a => a.status === 'idle').length,
                error: Array.from(stateSnapshot.agents.values())
                  .filter(a => a.status === 'error').length
              },
              byModel: Array.from(stateSnapshot.agents.values())
                .reduce((acc, agent) => {
                  const model = agent.model.model
                  acc[model] = (acc[model] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
            }
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
        summary: 'Server statistics',
        description: 'Get detailed server and agent statistics'
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
