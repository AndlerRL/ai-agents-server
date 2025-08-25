/**
 * Client-Side React Context for AI Agents Server
 * Manages client state, WebSocket connections, and agent interactions
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import type { 
  ClientState, 
  ClientAction, 
  AgentInstance, 
  ChatMessage, 
  WebhookEvent,
  StreamMessage 
} from '../core/types'

// ============================================================================
// Context Types
// ============================================================================

interface AgentsContextType {
  state: ClientState
  actions: {
    connect: () => void
    disconnect: () => void
    sendMessage: (message: string, agentId?: string) => Promise<void>
    createAgent: (name: string, model?: string) => Promise<void>
    deleteAgent: (agentId: string) => Promise<void>
    subscribeToEvents: (events: string[], filters?: Record<string, any>) => void
  }
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ClientState = {
  connected: false,
  agents: [],
  activeAgent: undefined,
  messages: [],
  isLoading: false,
  error: undefined
}

// ============================================================================
// Reducer
// ============================================================================

function updateState(oldState: ClientState, newState: Partial<ClientState>): ClientState {
  return {
    ...oldState,
    ...newState
  }
}

function clientReducer(state: ClientState, action: ClientAction): ClientState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return updateState(state, {
        connected: action.payload as boolean,
        error: action.payload ? undefined : state.error
      })
    case 'ADD_AGENT':
      const newAgent = action.payload as AgentInstance
      return updateState(state, {
        agents: [...state.agents, newAgent],
        activeAgent: state.activeAgent || newAgent.id
      })
    case 'SET_ACTIVE_AGENT':
      return updateState(state, {
        activeAgent: action.payload as string
      })
    case 'ADD_MESSAGE':
      const message = action.payload as ChatMessage
      return updateState(state, {
        messages: [...state.messages, message]
      })
    case 'SET_LOADING':
      return updateState(state, {
        isLoading: action.payload as boolean
      })
    case 'SET_ERROR':
      return updateState(state, {
        error: action.payload as string,
        isLoading: false
      })
    default:
      return state
  }
}

// ============================================================================
// Context Creation
// ============================================================================

const AgentsContext = createContext<AgentsContextType | undefined>(undefined)

// ============================================================================
// Provider Component
// ============================================================================

interface AgentsProviderProps {
  children: React.ReactNode
  serverUrl?: string
  autoConnect?: boolean
}

export function AgentsProvider({ 
  children, 
  serverUrl = 'ws://localhost:3000/webhooks/ws',
  autoConnect = true 
}: AgentsProviderProps) {
  const [state, dispatch] = useReducer(clientReducer, initialState)
  const wsRef = React.useRef<WebSocket | null>(null)

  // ============================================================================
  // WebSocket Management
  // ============================================================================

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    try {
      const ws = new WebSocket(serverUrl)
      
      ws.onopen = () => {
        console.log('🔗 Connected to AI Agents Server')
        dispatch({ type: 'SET_CONNECTED', payload: true })
      }

      ws.onmessage = (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('🔌 Disconnected from AI Agents Server', event.code)
        dispatch({ type: 'SET_CONNECTED', payload: false })
        
        // Auto-reconnect after 5 seconds if not a manual close
        if (event.code !== 1000 && autoConnect) {
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect...')
            connect()
          }, 5000)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        dispatch({ type: 'SET_ERROR', payload: 'WebSocket connection error' })
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to connect to server' })
    }
  }, [serverUrl, autoConnect])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    dispatch({ type: 'SET_CONNECTED', payload: false })
  }, [])

  // ============================================================================
  // Message Handling
  // ============================================================================

  const handleWebSocketMessage = useCallback((message: StreamMessage) => {
    if (message.type === 'error') {
      dispatch({ type: 'SET_ERROR', payload: message.error })
      return
    }

    if (message.type === 'data' && message.data) {
      const data = message.data as any

      // Handle different event types
      if (data.type === 'welcome') {
        console.log('👋 Welcome message received')
        return
      }

      if (data.type === 'heartbeat') {
        // Heartbeat - no action needed
        return
      }

      // Handle webhook events
      const event = data as WebhookEvent
      handleWebhookEvent(event)
    }
  }, [])

  const handleWebhookEvent = useCallback((event: WebhookEvent) => {
    switch (event.type) {
      case 'agent.created':
        // Fetch updated agent list
        fetchAgents()
        break

      case 'agent.processing':
        dispatch({ type: 'SET_LOADING', payload: true })
        break

      case 'agent.completed':
        dispatch({ type: 'SET_LOADING', payload: false })
        const { response, agentId } = event.payload as any
        
        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date()
        }
        dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage })
        break

      case 'agent.error':
        dispatch({ type: 'SET_LOADING', payload: false })
        dispatch({ type: 'SET_ERROR', payload: event.payload.error as string })
        break
    }
  }, [])

  // ============================================================================
  // API Actions
  // ============================================================================

  const sendMessage = useCallback(async (message: string, agentId?: string) => {
    if (!state.connected) {
      dispatch({ type: 'SET_ERROR', payload: 'Not connected to server' })
      return
    }

    dispatch({ type: 'SET_LOADING', payload: true })

    // Add user message to state
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    }
    dispatch({ type: 'ADD_MESSAGE', payload: userMessage })

    try {
      const response = await fetch('/v1/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          agentId: agentId || state.activeAgent
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      // Response will be handled via WebSocket event
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false })
      dispatch({ type: 'SET_ERROR', payload: `Failed to send message: ${error}` })
    }
  }, [state.connected, state.activeAgent])

  const createAgent = useCallback(async (name: string, model?: string) => {
    try {
      const response = await fetch('/v1/openai/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, model })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      // Agent will be added via WebSocket event
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to create agent: ${error}` })
    }
  }, [])

  const deleteAgent = useCallback(async (agentId: string) => {
    try {
      const response = await fetch(`/v1/openai/agents/${agentId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      // Remove agent from state
      const updatedAgents = state.agents.filter(agent => agent.id !== agentId)
      
      // Update state (this is a simplified approach)
      // In a real implementation, you might want to handle this via reducer
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to delete agent: ${error}` })
    }
  }, [state.agents])

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/v1/openai/agents')
      const result = await response.json()

      if (result.success) {
        // Update agents in state
        result.data.forEach((agent: AgentInstance) => {
          dispatch({ type: 'ADD_AGENT', payload: agent })
        })
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }, [])

  const subscribeToEvents = useCallback((events: string[], filters?: Record<string, any>) => {
    // This would update the WebSocket subscription
    // Implementation depends on server-side subscription management
    console.log('Subscribing to events:', events, filters)
  }, [])

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [connect, disconnect, autoConnect])

  // Fetch initial agents when connected
  useEffect(() => {
    if (state.connected) {
      fetchAgents()
    }
  }, [state.connected, fetchAgents])

  // ============================================================================
  // Context Value
  // ============================================================================

  const contextValue: AgentsContextType = {
    state,
    actions: {
      connect,
      disconnect,
      sendMessage,
      createAgent,
      deleteAgent,
      subscribeToEvents
    }
  }

  return (
    <AgentsContext.Provider value={contextValue}>
      {children}
    </AgentsContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useAgents(): AgentsContextType {
  const context = useContext(AgentsContext)
  if (!context) {
    throw new Error('useAgents must be used within an AgentsProvider')
  }
  return context
}

// ============================================================================
// Additional Hooks
// ============================================================================

export function useAgentMessages(agentId?: string): ChatMessage[] {
  const { state } = useAgents()
  
  return React.useMemo(() => {
    if (!agentId) return state.messages
    
    // Filter messages by agent (if you want to implement per-agent message history)
    return state.messages.filter(message => {
      // This would require additional metadata on messages
      return true // For now, return all messages
    })
  }, [state.messages, agentId])
}

export function useAgentStatus(agentId?: string): {
  agent?: AgentInstance
  isActive: boolean
  isProcessing: boolean
} {
  const { state } = useAgents()
  
  return React.useMemo(() => {
    const agent = agentId 
      ? state.agents.find(a => a.id === agentId)
      : state.agents.find(a => a.id === state.activeAgent)
    
    return {
      agent,
      isActive: agent?.id === state.activeAgent,
      isProcessing: agent?.status === 'processing' || state.isLoading
    }
  }, [state.agents, state.activeAgent, state.isLoading, agentId])
}

export function useServerHealth(): {
  connected: boolean
  error?: string
  reconnect: () => void
} {
  const { state, actions } = useAgents()
  
  return {
    connected: state.connected,
    error: state.error,
    reconnect: actions.connect
  }
}
