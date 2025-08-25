/**
 * Server State Management
 * Manages global server state using ElysiaJS state system
 * Provides centralized state access with type safety
 */

import type { ServerState, ServerStatistics, AgentInstance, MemoryStore } from './types'
import { EventEmitter } from 'eventemitter3'

export interface StateEvents {
  'agent:created': (agent: AgentInstance) => void
  'agent:updated': (agent: AgentInstance) => void
  'agent:deleted': (agentId: string) => void
  'connection:opened': (connectionId: string, socket: WebSocket) => void
  'connection:closed': (connectionId: string) => void
  'statistics:updated': (stats: ServerStatistics) => void
  'memory:updated': (key: string, entry: any) => void
}

export class ServerStateManager extends EventEmitter<StateEvents> {
  private state: ServerState

  constructor(memoryStore: MemoryStore) {
    super()
    
    this.state = {
      agents: new Map(),
      activeConnections: new Map(),
      statistics: {
        totalRequests: 0,
        activeAgents: 0,
        totalTokensUsed: 0,
        averageResponseTime: 0,
        errorRate: 0,
        memoryUsage: {
          total: 0,
          used: 0,
          available: 0,
          entries: 0
        },
        apiCalls: []
      },
      memory: memoryStore
    }
  }

  // ============================================================================
  // Agent Management
  // ============================================================================

  createAgent(agent: AgentInstance): void {
    this.state.agents.set(agent.id, agent)
    this.updateStatistics({ activeAgents: this.state.agents.size })
    this.emit('agent:created', agent)
  }

  getAgent(id: string): AgentInstance | undefined {
    return this.state.agents.get(id)
  }

  getAllAgents(): AgentInstance[] {
    return Array.from(this.state.agents.values())
  }

  updateAgent(id: string, updates: Partial<AgentInstance>): boolean {
    const agent = this.state.agents.get(id)
    if (!agent) return false

    const updatedAgent = { ...agent, ...updates }
    this.state.agents.set(id, updatedAgent)
    this.emit('agent:updated', updatedAgent)
    return true
  }

  deleteAgent(id: string): boolean {
    const deleted = this.state.agents.delete(id)
    if (deleted) {
      this.updateStatistics({ activeAgents: this.state.agents.size })
      this.emit('agent:deleted', id)
    }
    return deleted
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  addConnection(id: string, socket: WebSocket): void {
    this.state.activeConnections.set(id, socket)
    this.emit('connection:opened', id, socket)
  }

  removeConnection(id: string): boolean {
    const removed = this.state.activeConnections.delete(id)
    if (removed) {
      this.emit('connection:closed', id)
    }
    return removed
  }

  getConnection(id: string): WebSocket | undefined {
    return this.state.activeConnections.get(id)
  }

  getAllConnections(): WebSocket[] {
    return Array.from(this.state.activeConnections.values())
  }

  getConnectionCount(): number {
    return this.state.activeConnections.size
  }

  // ============================================================================
  // Statistics Management
  // ============================================================================

  updateStatistics(updates: Partial<ServerStatistics>): void {
    this.state.statistics = { ...this.state.statistics, ...updates }
    this.emit('statistics:updated', this.state.statistics)
  }

  incrementRequests(): void {
    this.state.statistics.totalRequests++
    this.emit('statistics:updated', this.state.statistics)
  }

  addTokenUsage(tokens: number): void {
    this.state.statistics.totalTokensUsed += tokens
    this.emit('statistics:updated', this.state.statistics)
  }

  updateResponseTime(newTime: number): void {
    const { totalRequests, averageResponseTime } = this.state.statistics
    const newAverage = totalRequests === 0 
      ? newTime 
      : (averageResponseTime * (totalRequests - 1) + newTime) / totalRequests
    
    this.updateStatistics({ averageResponseTime: newAverage })
  }

  recordApiCall(endpoint: string, latency: number, isError: boolean = false): void {
    const apiCalls = [...this.state.statistics.apiCalls]
    const existingIndex = apiCalls.findIndex(call => call.endpoint === endpoint)

    if (existingIndex >= 0) {
      const existing = apiCalls[existingIndex]
      apiCalls[existingIndex] = {
        ...existing,
        count: existing.count + 1,
        averageLatency: (existing.averageLatency * existing.count + latency) / (existing.count + 1),
        lastCalled: new Date(),
        errorCount: existing.errorCount + (isError ? 1 : 0)
      }
    } else {
      apiCalls.push({
        endpoint,
        count: 1,
        averageLatency: latency,
        lastCalled: new Date(),
        errorCount: isError ? 1 : 0
      })
    }

    this.updateStatistics({ apiCalls })
  }

  // ============================================================================
  // Memory Access
  // ============================================================================

  getMemoryStore(): MemoryStore {
    return this.state.memory
  }

  async updateMemoryUsage(): Promise<void> {
    // Implementation depends on memory store type
    // This is a placeholder that can be expanded based on actual memory store
    const memoryUsage = {
      total: 1000000, // 1MB default
      used: 0,
      available: 1000000,
      entries: 0
    }

    this.updateStatistics({ memoryUsage })
  }

  // ============================================================================
  // State Snapshots & Debugging
  // ============================================================================

  getStateSnapshot(): Readonly<ServerState> {
    return {
      agents: new Map(this.state.agents),
      activeConnections: new Map(this.state.activeConnections),
      statistics: { ...this.state.statistics },
      memory: this.state.memory
    }
  }

  getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    agents: number
    connections: number
    memoryUsage: number
    errorRate: number
  } {
    const { statistics } = this.state
    const errorRate = statistics.errorRate
    const memoryUsagePercent = statistics.memoryUsage.total > 0 
      ? (statistics.memoryUsage.used / statistics.memoryUsage.total) * 100 
      : 0

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (errorRate > 0.1 || memoryUsagePercent > 90) {
      status = 'unhealthy'
    } else if (errorRate > 0.05 || memoryUsagePercent > 75) {
      status = 'degraded'
    }

    return {
      status,
      agents: statistics.activeAgents,
      connections: this.getConnectionCount(),
      memoryUsage: memoryUsagePercent,
      errorRate
    }
  }

  // ============================================================================
  // Cleanup & Disposal
  // ============================================================================

  async dispose(): Promise<void> {
    // Close all WebSocket connections
    for (const [id, socket] of this.state.activeConnections) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Server shutting down')
      }
    }

    // Clear state
    this.state.agents.clear()
    this.state.activeConnections.clear()
    
    // Remove all listeners
    this.removeAllListeners()
  }
}

// Factory function for creating state manager
export function createServerStateManager(memoryStore: MemoryStore): ServerStateManager {
  return new ServerStateManager(memoryStore)
}
