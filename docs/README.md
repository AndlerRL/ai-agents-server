# AI Agents Server Documentation

## Overview

The AI Agents Server is a sophisticated agentic AI platform built with ElysiaJS, providing multi-model LLM support, real-time event streaming, and intelligent memory management. The server implements a clean dependency injection architecture with modular components for maximum extensibility.

## Architecture

### Core Components

1. **Dependency Injection Container** (`src/core/container.ts`)
   - Centralized service registration and resolution
   - Supports singleton, transient, and scoped lifecycles
   - Handles circular dependency detection

2. **Server State Management** (`src/core/state.ts`)
   - ElysiaJS state integration (see next section for details)
   - Agent lifecycle management
   - Real-time statistics tracking
   - Event-driven architecture

3. **Webhook & Event Streaming** (`src/core/webhooks.ts`)
   - WebSocket-based real-time communication
   - Event filtering and subscription management
   - Message persistence and buffering
   - Heartbeat and connection management

4. **Memory Store** (`src/core/memory.ts`)
   - Flexible memory storage with multiple backends
   - Intelligent document chunking strategies
   - Semantic search capabilities
   - TTL and cleanup management

5. **LLM & Tool Management** (`src/core/llm.ts`)
   - Multi-provider model support (OpenAI, extensible)
   - Tool registry and execution framework
   - Function calling integration
   - Custom provider extension points

---

## Server State Management with Elysia

The server uses **Elysia's built-in state management** for all metrics, agent tracking, and service initialization. This replaces custom state management with standard Elysia patterns for type safety, performance, and maintainability.

### State Structure

```typescript
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
  openaiEnabled: true,
  debugMode: false
})
```

### Service Initialization via `.derive()`

```typescript
.derive({ as: 'global' }, async () => {
  // Initialize core services
  const memoryStore = createMemoryStore('enhanced', config.chunking)
  const serverState = createServerStateManager(memoryStore)
  const webhookManager = createWebhookManager(...)
  const toolRegistry = createToolRegistry()
  const llmManager = createLLMManager(toolRegistry)

  // OpenAI provider setup
  // Agent management functions
  // WebSocket operations
  // LLM operations

  return { /* all services and functions */ }
})
```

### Request Tracking Middleware

```typescript
.onBeforeHandle(({ incrementRequests }) => {
  incrementRequests()
})
.onAfterHandle(({ updateResponseTime }) => {
  updateResponseTime(responseTime)
})
.onError(({ updateErrorRate, error }) => {
  updateErrorRate(true)
})
```

### State Management Functions

Available in all route handlers via Elysia's context:

```typescript
// Statistics
incrementRequests(), addTokenUsage(tokens), updateResponseTime(time)
updateErrorRate(hasError), incrementAgents(), decrementAgents()

// Services
createAgent(data), deleteAgent(id), getAgent(id), getAllAgents()
chatWithAgent(model, messages), executeAgentTool(tool, params)
addWebSocketConnection(ws), broadcastEvent(type, payload)

// Status
getHealthStatus(), getServerStats()
```

---

## API Endpoints

### OpenAI Agents API (`/v1/openai/`)

#### Agent Management

- `POST /v1/openai/agents` - Create new agent
- `GET /v1/openai/agents` - List all agents
- `GET /v1/openai/agents/:id` - Get agent by ID
- `DELETE /v1/openai/agents/:id` - Delete agent

#### Chat Completions

- `POST /v1/openai/chat/completions` - Send message to agent

#### Tool Management

- `GET /v1/openai/tools` - List available tools
- `POST /v1/openai/tools/:name/execute` - Execute tool

#### Models

- `GET /v1/openai/models` - List OpenAI models

### Vercel AI SDK (`/v1/vercel/`)

*Note: This is an expansion point for future Vercel AI SDK integration*

- `GET /v1/vercel/` - Dashboard information
- `POST /v1/vercel/chat` - Chat with Vercel AI SDK (placeholder)
- `POST /v1/vercel/stream` - Streaming responses (placeholder)
- `POST /v1/vercel/embed` - Generate embeddings (placeholder)

### Webhooks & Events (`/webhooks/`)

#### Event Management

- `GET /webhooks/events` - Get recent events
- `POST /webhooks/broadcast` - Broadcast custom event

#### Subscription Management

- `GET /webhooks/subscriptions` - List active subscriptions
- `POST /webhooks/subscriptions/:id/update` - Update subscription
- `DELETE /webhooks/subscriptions/:id` - Remove subscription

#### Statistics

- `GET /webhooks/stats` - Get webhook statistics

### Dashboard (`/dashboard/`)

#### Overview

- `GET /dashboard/` - Main dashboard with server health
- `GET /dashboard/agents` - Agent overview
- `GET /dashboard/statistics` - Detailed statistics
- `GET /dashboard/logs` - Server logs
- `GET /dashboard/memory` - Memory usage statistics
- `GET /dashboard/tools` - Tool information

#### Actions

- `POST /dashboard/actions/cleanup` - Clean inactive agents
- `POST /dashboard/actions/restart` - Request server restart

## Data Models

### Agent Instance

```typescript
interface AgentInstance {
  id: string
  name: string
  model: LLMModel
  tools: Tool[]
  memory: MemoryStore
  status: 'idle' | 'processing' | 'error'
  createdAt: Date
  lastActivity: Date
}
```

### Chat Request

```typescript
interface ChatRequest {
  message: string
  agentId?: string
  model?: string
  tools?: string[]
  context?: Record<string, unknown>
  stream?: boolean
}
```

### Webhook Event

```typescript
interface WebhookEvent {
  id: string
  type: WebhookEventType
  payload: Record<string, unknown>
  timestamp: Date
  source: string
}
```

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_ORGANIZATION=your_org_id (optional)
OPENAI_BASE_URL=custom_base_url (optional)

# Memory Configuration
MEMORY_PROVIDER=memory # memory | redis | postgresql
MEMORY_MAX_SIZE=100000
MEMORY_TTL=3600

# Chunking Configuration
CHUNK_STRATEGY=semantic # fixed | semantic | sliding | custom
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### Server Configuration

```typescript
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3000'),
  environment: process.env.NODE_ENV || 'development',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    organization: process.env.OPENAI_ORGANIZATION,
    baseURL: process.env.OPENAI_BASE_URL
  },
  memory: {
    provider: 'memory',
    maxSize: 100000,
    ttl: 3600
  },
  chunking: {
    strategy: 'semantic',
    chunkSize: 1000,
    overlap: 200
  }
}
```

## WebSocket Integration

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () => {
  console.log('Connected to AI Agents Server')
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Event received:', message)
}
```

### Event Types

- `agent.created` - New agent created
- `agent.processing` - Agent processing request
- `agent.completed` - Agent completed request
- `agent.error` - Agent encountered error
- `tool.executed` - Tool execution completed
- `memory.updated` - Memory store updated
- `conversation.started` - New conversation started
- `conversation.ended` - Conversation ended

## Extension Points

### Custom Model Providers

```typescript
class CustomProvider implements ModelProvider {
  name = 'custom'
  
  async initialize(config: Record<string, unknown>): Promise<void> {
    // Initialize custom provider
  }
  
  async chat(messages: ChatMessage[], config: LLMConfig): Promise<ChatResponse> {
    // Implement chat completion
  }
  
  async embed(text: string): Promise<number[]> {
    // Implement embedding generation
  }
}
```

### Custom Tools

```typescript
const customTool: Tool = {
  name: 'custom_analysis',
  description: 'Perform custom analysis',
  category: 'custom',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'Data to analyze' }
    },
    required: ['data']
  },
  handler: async (params) => {
    // Implement tool logic
    return { success: true, data: 'Analysis result' }
  }
}
```

### Custom Chunking Strategies

```typescript
const customChunkingConfig: ChunkingConfig = {
  strategy: 'custom',
  chunkSize: 1000,
  overlap: 200,
  customStrategy: (text: string, config: ChunkingConfig) => {
    // Implement custom chunking logic
    return chunks
  }
}
```

### Prompt Strategies (Expansion Point)

```typescript
interface PromptStrategy {
  name: string
  transform: (prompt: string, context: Record<string, unknown>) => string
  validate: (prompt: string) => { valid: boolean; reason?: string }
}
```

## Security Considerations

### Prompt Injection Protection

- Input validation and sanitization
- Prompt transformation strategies
- Content filtering mechanisms
- Rate limiting and abuse prevention

### API Security

- Authentication and authorization (expansion point)
- Request validation with Zod schemas
- CORS configuration
- Rate limiting (expansion point)

### Memory Security

- Data encryption at rest (expansion point)
- Access control for memory stores
- Data retention policies
- Secure cleanup procedures

## Performance Optimization

### Memory Management

- Intelligent chunking strategies
- TTL-based cleanup
- Memory usage monitoring
- Garbage collection optimization

### Connection Management

- WebSocket connection pooling
- Heartbeat mechanisms
- Connection limits and throttling
- Event buffering and batching

### Caching Strategies

- Response caching (expansion point)
- Model result caching
- Embedding caching
- Tool result caching

## Monitoring & Debugging

### Statistics Tracking

- Request/response metrics
- Token usage tracking
- Error rate monitoring
- Performance profiling

### Logging

- Structured logging with context
- Error tracking and reporting
- Audit trails for actions
- Debug information collection

### Health Checks

- Service availability monitoring
- Resource usage tracking
- Dependency health checks
- Alerting mechanisms (expansion point)

## Development Workflow

### Setup

```bash
# Install dependencies
bun install

# Set environment variables
cp .env.example .env

# Start development server
bun run dev
```

### Testing

```bash
# Run tests
bun test

# Run tests in watch mode
bun run test:watch
```

### Building

```bash
# Build for production
bun run build

# Start production server
bun start
```

## Deployment

### Docker (Expansion Point)

```dockerfile
FROM oven/bun:alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY src ./src
RUN bun run build
EXPOSE 3000
CMD ["bun", "start"]
```

### Environment-Specific Configurations

- Development: Enhanced logging, hot reload
- Staging: Production-like setup with debug info
- Production: Optimized performance, minimal logging

## Troubleshooting

### Common Issues

1. **OpenAI API Key Missing**: Set OPENAI_API_KEY environment variable
2. **WebSocket Connection Failed**: Check CORS settings and port availability
3. **Memory Store Full**: Increase MEMORY_MAX_SIZE or implement cleanup
4. **Tool Execution Timeout**: Implement timeout handling in tool handlers

### Debug Mode

Set `NODE_ENV=development` for enhanced debugging features:

- Detailed error messages
- Request/response logging
- WebSocket message tracing
- Memory usage reporting

## Future Roadmap

### Planned Features

1. **Multi-Provider Support**: Anthropic, Google AI, custom providers
2. **Advanced Memory**: Vector databases, semantic search
3. **Authentication**: JWT, OAuth2, API keys
4. **Streaming**: Real-time response streaming
5. **Clustering**: Multi-instance deployment
6. **Analytics**: Advanced metrics and reporting
7. **Plugin System**: Dynamic plugin loading
8. **Web Interface**: Admin dashboard UI
