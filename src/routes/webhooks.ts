/**
 * Webhook Routes
 * Provides WebSocket connection management and event subscription endpoints
 */

import { Elysia, t } from 'elysia'
import type { WebhookManager } from '../core/webhooks'

export function createWebhookRoutes(app: Elysia) {
  return app
    .get('/', () => ({
      title: 'Webhook & Event Streaming',
      description: 'Real-time event streaming and webhook management',
      features: [
        'WebSocket Connections',
        'Event Filtering & Subscriptions',
        'Real-time Agent Updates',
        'Tool Execution Events',
        'Memory & State Changes'
      ],
      endpoints: {
        connect: 'ws://localhost:3000/ws',
        events: '/webhooks/events',
        subscriptions: '/webhooks/subscriptions',
        statistics: '/webhooks/stats'
      },
      eventTypes: [
        'agent.created',
        'agent.processing',
        'agent.completed',
        'agent.error',
        'tool.executed',
        'memory.updated',
        'conversation.started',
        'conversation.ended',
        'mcp.server.started',
        'mcp.server.stopped',
        'mcp.server.error',
        'mcp.server.restarted',
        'mcp.tool.called',
        'mcp.tool.completed',
        'mcp.tool.error',
        'mcp.prompt.called',
        'mcp.prompt.completed',
        'mcp.resource.accessed',
        'mcp.agent.created',
        'mcp.agent.updated'
      ]
    }), {
      detail: {
        tags: ['Webhooks'],
        summary: 'Webhook dashboard',
        description: 'Get webhook and event streaming information'
      }
    })

    .get('/events', async (context) => {
      try {
        const { query } = context
        const webhooks = (context as any).webhooks as WebhookManager
        
        const limit = parseInt(query.limit as string) || 50
        const type = query.type as string
        
        let events
        if (type) {
          events = webhooks.getEventsByType(type as any, limit)
        } else {
          events = webhooks.getRecentEvents(limit)
        }
        
        return {
          success: true,
          data: events,
          meta: {
            count: events.length,
            limit,
            type: type || 'all'
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get events: ${error}`
        }
      }
    }, {
      query: t.Object({
        limit: t.Optional(t.String()),
        type: t.Optional(t.String())
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Get recent events',
        description: 'Retrieve recent webhook events with optional filtering'
      }
    })

    .get('/subscriptions', (context) => {
      try {
        const webhooks = (context as any).webhooks as WebhookManager
        const subscriptions = webhooks.getSubscriptions()
        
        return {
          success: true,
          data: subscriptions.map(sub => ({
            id: sub.id,
            events: sub.events,
            filters: sub.filters,
            clientId: sub.clientId,
            connected: sub.socket.readyState === WebSocket.OPEN
          }))
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get subscriptions: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Webhooks'],
        summary: 'List active subscriptions',
        description: 'Get all active WebSocket subscriptions'
      }
    })

    .post('/subscriptions/:id/update', async (context) => {
      try {
        const { params, body, set } = context
        const webhooks = (context as any).webhooks as WebhookManager
        
        const { events, filters } = body as {
          events?: string[]
          filters?: Record<string, any>
        }
        
        const updated = webhooks.updateSubscription(params.id, {
          events: events as any,
          filters
        })
        
        if (!updated) {
          set.status = 404
          return {
            success: false,
            error: 'Subscription not found'
          }
        }
        
        return {
          success: true,
          message: 'Subscription updated successfully'
        }
      } catch (error) {
        ;(context as any).set.status = 500
        return {
          success: false,
          error: `Failed to update subscription: ${error}`
        }
      }
    }, {
      body: t.Object({
        events: t.Optional(t.Array(t.String())),
        filters: t.Optional(t.Object({}))
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Update subscription',
        description: 'Update event filters for a WebSocket subscription'
      }
    })

    .delete('/subscriptions/:id', (context) => {
      try {
        const { params, set } = context
        const webhooks = (context as any).webhooks as WebhookManager
        
        const removed = webhooks.unsubscribe(params.id)
        
        if (!removed) {
          set.status = 404
          return {
            success: false,
            error: 'Subscription not found'
          }
        }
        
        return {
          success: true,
          message: 'Subscription removed successfully'
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to remove subscription: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Webhooks'],
        summary: 'Remove subscription',
        description: 'Close and remove a WebSocket subscription'
      }
    })

    .get('/stats', (context) => {
      try {
        const webhooks = (context as any).webhooks as WebhookManager
        const stats = webhooks.getStatistics()
        
        return {
          success: true,
          data: stats
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to get webhook statistics: ${error}`
        }
      }
    }, {
      detail: {
        tags: ['Webhooks'],
        summary: 'Get webhook statistics',
        description: 'Retrieve webhook and connection statistics'
      }
    })

    .post('/broadcast', async (context) => {
      try {
        const { body, set } = context
        const webhooks = (context as any).webhooks as WebhookManager
        
        const { type, payload, source = 'manual' } = body as {
          type: string
          payload: Record<string, unknown>
          source?: string
        }
        
        await webhooks.broadcast({
          type: type as any,
          payload,
          source
        })
        
        return {
          success: true,
          message: 'Event broadcasted successfully'
        }
      } catch (error) {
        ;(context as any).set.status = 500
        return {
          success: false,
          error: `Failed to broadcast event: ${error}`
        }
      }
    }, {
      body: t.Object({
        type: t.String(),
        payload: t.Object({}),
        source: t.Optional(t.String())
      }),
      detail: {
        tags: ['Webhooks'],
        summary: 'Broadcast event',
        description: 'Manually broadcast an event to all subscribers'
      }
    })
}
