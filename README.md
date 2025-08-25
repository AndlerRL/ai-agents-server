# AI Agents Server - Quick Start Guide

## Prerequisites

- Bun runtime environment
- OpenAI API key (optional, but recommended for full functionality)
- Node.js 18+ (if using npm/yarn instead of Bun)

## Installation & Setup

1. **Clone and Install Dependencies**

   ```bash
   cd ai-agents-server
   bun install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.sample .env
   # Edit .env with your OpenAI API key
   ```

3. **Start Development Server**

   ```bash
   bun run dev
   ```

## Basic Usage

### 1. Create an Agent [TODO: I have to grow this idea... 🤔]

```bash
curl -X POST http://localhost:3000/v1/openai/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Agent",
    "model": "gpt-4o-mini",
    "tools": ["analyze_text"]
  }'
```

### 2. Send a Message

```bash
curl -X POST http://localhost:3000/v1/openai/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, can you help me analyze some text?"
  }'
```

### 3. WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws')
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Event:', message)
}
```

## Available Endpoints

### OpenAI Agents API

- **Dashboard**: `GET /v1/openai/`
- **Create Agent**: `POST /v1/openai/agents`
- **Chat**: `POST /v1/openai/chat/completions`
- **List Tools**: `GET /v1/openai/tools`

### Management

- **Health Check**: `GET /health`
- **Dashboard**: `GET /dashboard/`
- **API Docs**: `GET /swagger`

### WebSocket Events

- **Connection**: `ws://localhost:3000/ws`
- **Event Management**: `/webhooks/*`

## Built-in Tools

### Text Analysis Tool

```bash
curl -X POST http://localhost:3000/v1/openai/tools/analyze_text/execute \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a sample text for analysis",
    "analysis_type": "all"
  }'
```

### Search Tool (Placeholder)

```bash
curl -X POST http://localhost:3000/v1/openai/tools/search/execute \
  -H "Content-Type: application/json" \
  -d '{
    "query": "AI agents",
    "source": "memory",
    "limit": 10
  }'
```

## Development Commands

```bash
# Development with hot reload
bun run dev

# Build for production
bun run build

# Start production server
bun start

# Run tests
bun test

# Format code
bun run format

# Lint code
bun run lint
```

## Architecture Overview

```
src/
├── core/           # Core framework components
│   ├── types.ts    # Type definitions
│   ├── container.ts # Dependency injection
│   ├── state.ts    # Server state management
│   ├── webhooks.ts # Event streaming
│   ├── memory.ts   # Memory store
│   └── llm.ts      # LLM & tool management
├── routes/         # API route handlers
│   ├── openai.ts   # OpenAI Agents API
│   ├── vercel.ts   # Vercel AI SDK (placeholder)
│   ├── webhooks.ts # WebSocket management
│   └── dashboard.ts # Management interface
├── lib/            # Utilities and helpers
└── index.ts        # Main server entry point
```

## Configuration Options

### Memory Chunking Strategies

- **Fixed**: Fixed-size chunks
- **Semantic**: Sentence-based chunks
- **Sliding**: Overlapping windows
- **Custom**: Implement your own strategy

### LLM Models (OpenAI)

- **gpt-4o**: Latest GPT-4 Optimized
- **gpt-4o-mini**: Faster, cost-effective option

### Event Types

- `agent.*`: Agent lifecycle events
- `tool.executed`: Tool execution results
- `memory.updated`: Memory store changes
- `conversation.*`: Chat session events

## Extension Points

### Custom Tools

```typescript
const customTool: Tool = {
  name: 'my_custom_tool',
  description: 'My custom tool',
  category: 'custom',
  parameters: { /* tool schema */ },
  handler: async (params) => {
    // Implementation
    return { success: true, data: result }
  }
}

// Register the tool
toolRegistry.register(customTool)
```

### Custom Model Providers

```typescript
class MyProvider implements ModelProvider {
  name = 'my_provider'
  
  async initialize(config: Record<string, unknown>): Promise<void> {
    // Setup provider
  }
  
  async chat(messages: ChatMessage[], config: LLMConfig): Promise<ChatResponse> {
    // Implement chat completion
  }
  
  async embed(text: string): Promise<number[]> {
    // Implement embedding generation
  }
}
```

### Custom Chunking Strategies

```typescript
const customChunking: ChunkingConfig = {
  strategy: 'custom',
  chunkSize: 1000,
  overlap: 200,
  customStrategy: (text: string, config: ChunkingConfig) => {
    // Implement custom chunking logic
    return chunks
  }
}
```

## Troubleshooting

### Common Issues

1. **OpenAI API Key Missing**
   - Set `OPENAI_API_KEY` in `.env` file
   - Server will start but OpenAI features will be disabled

2. **WebSocket Connection Failed**
   - Check if port 3000 is available
   - Verify CORS settings for browser connections

3. **Memory Store Full**
   - Increase `MEMORY_MAX_SIZE` in configuration
   - Implement periodic cleanup

### Debug Mode

```bash
NODE_ENV=development bun run dev
```

This enables:

- Enhanced error messages
- Request/response logging
- WebSocket message tracing
- Memory usage reporting

## Next Steps

1. **Implement Vercel AI SDK Integration**
   - Add streaming responses
   - Multi-provider support
   - Function calling

2. **Add Authentication**
   - JWT token support
   - API key management
   - Rate limiting

3. **Enhanced Memory**
   - Vector database integration
   - Semantic search
   - Embedding generation

4. **Monitoring & Analytics**
   - Metrics collection
   - Performance profiling
   - Error tracking

## Support & Resources

- **API Documentation**: <http://localhost:3000/swagger>
- **Dashboard**: <http://localhost:3000/dashboard>
- **Health Check**: <http://localhost:3000/health>
- **Documentation**: `/docs/README.md`
