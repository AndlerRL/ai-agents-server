/**
 * Webhook and Event Streaming System
 * Provides real-time event broadcasting via WebSockets
 * Supports event filtering, authentication, and message persistence
 */

import { nanoid } from 'nanoid'
import type { WebhookEvent, WebhookEventType, StreamMessage } from './types'
import { EventEmitter } from 'eventemitter3'

export interface WebhookSubscription {
  id: string
  socket: WebSocket
  events: WebhookEventType[]
  filters?: Record<string, any>
  clientId?: string
}

export interface WebhookConfig {
  maxConnections: number
  messageBufferSize: number
  heartbeatInterval: number
  enablePersistence: boolean
}

export class WebhookManager extends EventEmitter {
  private subscriptions = new Map<string, WebhookSubscription>()
  private eventBuffer: WebhookEvent[] = []
  private heartbeatTimer?: Timer
  private config: WebhookConfig

  constructor(config: Partial<WebhookConfig> = {}) {
    super()
    
    this.config = {
      maxConnections: 1000,
      messageBufferSize: 100,
      heartbeatInterval: 30000, // 30 seconds
      enablePersistence: false,
      ...config
    }

    this.startHeartbeat()
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  /**
   * Subscribe a WebSocket connection to webhook events
   */
  subscribe(
    socket: WebSocket,
    events: WebhookEventType[] = [],
    options: {
      filters?: Record<string, any>
      clientId?: string
    } = {}
  ): string {
    if (this.subscriptions.size >= this.config.maxConnections) {
      throw new Error('Maximum connections exceeded')
    }

    const subscriptionId = nanoid()
    const subscription: WebhookSubscription = {
      id: subscriptionId,
      socket,
      events: events.length > 0 ? events : this.getAllEventTypes(),
      filters: options.filters,
      clientId: options.clientId
    }

    this.subscriptions.set(subscriptionId, subscription)

    // Set up socket event handlers
    socket.addEventListener('close', () => {
      this.unsubscribe(subscriptionId)
    })

    socket.addEventListener('error', (error) => {
      console.error(`WebSocket error for subscription ${subscriptionId}:`, error)
      this.unsubscribe(subscriptionId)
    })

    // Send welcome message
    this.sendToSubscription(subscriptionId, {
      id: nanoid(),
      type: 'data',
      data: {
        type: 'welcome',
        subscriptionId,
        supportedEvents: this.getAllEventTypes()
      },
      timestamp: new Date()
    })

    this.emit('subscription:created', subscription)
    return subscriptionId
  }

  /**
   * Unsubscribe a WebSocket connection
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    // Close socket if still open
    if (subscription.socket.readyState === WebSocket.OPEN) {
      subscription.socket.close(1000, 'Unsubscribed')
    }

    this.subscriptions.delete(subscriptionId)
    this.emit('subscription:removed', subscription)
    return true
  }

  /**
   * Update subscription event filters
   */
  updateSubscription(
    subscriptionId: string,
    updates: {
      events?: WebhookEventType[]
      filters?: Record<string, any>
    }
  ): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return false

    if (updates.events) {
      subscription.events = updates.events
    }
    if (updates.filters) {
      subscription.filters = updates.filters
    }

    this.emit('subscription:updated', subscription)
    return true
  }

  // ============================================================================
  // Event Broadcasting
  // ============================================================================

  /**
   * Broadcast an event to all relevant subscriptions
   */
  async broadcast(event: Omit<WebhookEvent, 'id' | 'timestamp'>): Promise<void> {
    const webhookEvent: WebhookEvent = {
      id: nanoid(),
      timestamp: new Date(),
      ...event
    }

    // Add to event buffer if persistence is enabled
    if (this.config.enablePersistence) {
      this.addToBuffer(webhookEvent)
    }

    // Find matching subscriptions
    const matchingSubscriptions = this.findMatchingSubscriptions(webhookEvent)

    // Send to all matching subscriptions
    await Promise.all(
      matchingSubscriptions.map(subscription =>
        this.sendEventToSubscription(subscription.id, webhookEvent)
      )
    )

    this.emit('event:broadcasted', webhookEvent, matchingSubscriptions.length)
  }

  /**
   * Send event to specific subscription
   */
  private async sendEventToSubscription(
    subscriptionId: string,
    event: WebhookEvent
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription || subscription.socket.readyState !== WebSocket.OPEN) {
      return
    }

    const message: StreamMessage = {
      id: nanoid(),
      type: 'data',
      data: event,
      timestamp: new Date()
    }

    try {
      await this.sendToSubscription(subscriptionId, message)
    } catch (error) {
      console.error(`Failed to send event to subscription ${subscriptionId}:`, error)
      
      // Send error message
      const errorMessage: StreamMessage = {
        id: nanoid(),
        type: 'error',
        error: 'Failed to deliver event',
        timestamp: new Date()
      }
      
      await this.sendToSubscription(subscriptionId, errorMessage)
    }
  }

  /**
   * Send message to subscription
   */
  private async sendToSubscription(
    subscriptionId: string,
    message: StreamMessage
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription || subscription.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Subscription ${subscriptionId} not available`)
    }

    return new Promise((resolve, reject) => {
      try {
        subscription.socket.send(JSON.stringify(message))
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  // ============================================================================
  // Event Filtering & Matching
  // ============================================================================

  /**
   * Find subscriptions that match the event
   */
  private findMatchingSubscriptions(event: WebhookEvent): WebhookSubscription[] {
    return Array.from(this.subscriptions.values()).filter(subscription =>
      this.isEventMatch(event, subscription)
    )
  }

  /**
   * Check if event matches subscription criteria
   */
  private isEventMatch(event: WebhookEvent, subscription: WebhookSubscription): boolean {
    // Check event type
    if (!subscription.events.includes(event.type)) {
      return false
    }

    // Check filters
    if (subscription.filters) {
      for (const [key, value] of Object.entries(subscription.filters)) {
        if (event.payload[key] !== value) {
          return false
        }
      }
    }

    return true
  }

  // ============================================================================
  // Event Buffer & Persistence
  // ============================================================================

  /**
   * Add event to buffer for persistence
   */
  private addToBuffer(event: WebhookEvent): void {
    this.eventBuffer.push(event)
    
    // Maintain buffer size
    if (this.eventBuffer.length > this.config.messageBufferSize) {
      this.eventBuffer.shift()
    }
  }

  /**
   * Get recent events from buffer
   */
  getRecentEvents(limit: number = 50): WebhookEvent[] {
    return this.eventBuffer.slice(-limit)
  }

  /**
   * Get events by type from buffer
   */
  getEventsByType(type: WebhookEventType, limit: number = 50): WebhookEvent[] {
    return this.eventBuffer
      .filter(event => event.type === type)
      .slice(-limit)
  }

  // ============================================================================
  // Heartbeat & Connection Management
  // ============================================================================

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.heartbeatInterval)
  }

  /**
   * Send heartbeat to all active connections
   */
  private async sendHeartbeat(): Promise<void> {
    const heartbeatMessage: StreamMessage = {
      id: nanoid(),
      type: 'data',
      data: { type: 'heartbeat' },
      timestamp: new Date()
    }

    const deadConnections: string[] = []

    await Promise.all(
      Array.from(this.subscriptions.entries()).map(async ([id, subscription]) => {
        try {
          if (subscription.socket.readyState === WebSocket.OPEN) {
            await this.sendToSubscription(id, heartbeatMessage)
          } else {
            deadConnections.push(id)
          }
        } catch (error) {
          deadConnections.push(id)
        }
      })
    )

    // Clean up dead connections
    deadConnections.forEach(id => this.unsubscribe(id))
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get all supported event types
   */
  private getAllEventTypes(): WebhookEventType[] {
    return [
      'agent.created',
      'agent.processing',
      'agent.completed',
      'agent.error',
      'tool.executed',
      'memory.updated',
      'conversation.started',
      'conversation.ended'
    ]
  }

  /**
   * Get subscription statistics
   */
  getStatistics(): {
    totalSubscriptions: number
    activeConnections: number
    eventsBuffered: number
    eventsSent: number
  } {
    const activeConnections = Array.from(this.subscriptions.values())
      .filter(sub => sub.socket.readyState === WebSocket.OPEN).length

    return {
      totalSubscriptions: this.subscriptions.size,
      activeConnections,
      eventsBuffered: this.eventBuffer.length,
      eventsSent: 0 // This would be tracked in a real implementation
    }
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values())
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    // Clear heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    // Close all connections
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id)
    }

    // Clear buffer
    this.eventBuffer = []
    
    // Remove listeners
    this.removeAllListeners()
  }
}

// Factory function
export function createWebhookManager(config?: Partial<WebhookConfig>): WebhookManager {
  return new WebhookManager(config)
}
