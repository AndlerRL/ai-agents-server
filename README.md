# AI Agents Server - Quick Start Guide

**Advanced AI Agent Server with OpenAI, Vercel AI SDK, RAG, and Model Context Protocol (MCP) Support**

## Features

- 🤖 **OpenAI & Vercel AI SDK Integration** - Support for multiple AI frameworks
- 🔧 **Model Context Protocol (MCP)** - Connect agents to external tools and data sources
- 🧠 **RAG System** - Advanced retrieval-augmented generation with multiple strategies
- 🔄 **Real-time WebSocket Events** - Monitor agent activities in real-time
- 📊 **Interactive Dashboard** - Beautiful React + TailwindCSS dashboard with SSR
- 🛠️ **Extensible Architecture** - Easy to add custom tools and providers
- 📈 **Feature-Organized Statistics** - Separate stats for OpenAI, Vercel AI, and MCP

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

### Core APIs

- **Dashboard**: `GET /` - Server overview, features, and statistics
- **API Info**: `GET /api` - API capabilities
- **Documentation**: `GET /docs` - Interactive Swagger API docs

### Statistics (Feature-Organized)

- **Complete Stats**: `GET /stats` - All system statistics
- **OpenAI Stats**: `GET /stats/openai` - OpenAI SDK usage and metrics
- **Vercel AI Stats**: `GET /stats/ai` - Vercel AI SDK metrics (coming soon)
- **MCP Stats**: `GET /stats/mcp` - MCP servers and tool execution metrics

### OpenAI Agents API

- **Dashboard**: `GET /v1/openai/`
- **Create Agent**: `POST /v1/openai/agents`
- **Chat**: `POST /v1/openai/chat/completions`
- **List Tools**: `GET /v1/openai/tools`

### Vercel AI SDK

- **Dashboard**: `GET /v1/ai/`
- **Streaming Chat**: `POST /v1/ai/chat/stream`

### RAG System

- **Retrieve**: `POST /v1/rag/retrieve`
- **Adaptive Retrieval**: `POST /v1/rag/adaptive`
- **Documents**: `POST /v1/rag/documents`
- **Health**: `GET /v1/rag/health`

### Model Context Protocol (MCP) 🆕

- **MCP Dashboard**: `GET /api/mcp/`
- **Start Server**: `POST /api/mcp/servers`
- **List Tools**: `GET /api/mcp/tools`
- **Execute Tool**: `POST /api/mcp/tools/execute`
- **Create MCP Agent**: `POST /api/mcp/agents`
- **Statistics**: `GET /mcp/stats`
- **Documentation**: `GET /mcp/docs`

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
- `mcp.*`: Model Context Protocol events

## Model Context Protocol (MCP) 🆕

The server now supports the Model Context Protocol, allowing agents to connect to external tools and data sources through standardized MCP servers.

### Quick Start with MCP

```bash
# 1. Start an MCP server (e.g., file system)
curl -X POST http://localhost:3001/api/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "filesystem",
    "name": "File System",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
    "autoRestart": true
  }'

# 2. Create an agent with MCP integration
curl -X POST http://localhost:3001/api/mcp/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "name": "File Assistant",
      "model": {"provider": "openai", "model": "gpt-4o-mini", "config": {}},
      "tools": [],
      "memory": {},
      "status": "idle"
    },
    "mcpServers": ["filesystem"],
    "sdkType": "openai",
    "autoImportTools": true
  }'

# 3. Agent now has file system tools automatically!
```

### Available MCP Servers

- **File System**: Local file operations
- **GitHub**: Repository management
- **Brave Search**: Web search
- **Custom**: Create your own MCP server

### MCP Documentation

- [Full Integration Guide](./docs/mcp-integration.md) - Comprehensive MCP documentation
- [Developer Guide](./docs/mcp-development-guide.md) - Quick start with examples
- [MCP Summary](./docs/MCP_SUMMARY.md) - Technical implementation overview

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

## Documentation

- **[API Dashboard Guide](./docs/api-dashboard.md)** - Complete guide to statistics and monitoring
- **[MCP Integration](./docs/mcp-integration.md)** - MCP architecture and API reference
- **[MCP Development](./docs/mcp-development-guide.md)** - Quick start guide for MCP
- **[Dual Database Architecture](./docs/dual-database-architecture.md)** - pgvector + Neo4j setup
- **[Interactive API Docs](http://localhost:3001/docs)** - Swagger documentation (when server is running)

## Troubleshooting

### Common Issues

1. **OpenAI API Key Missing**
   - Set `OPENAI_API_KEY` in `.env` file
   - Server will start but OpenAI features will be disabled

2. **WebSocket Connection Failed**
   - Check if port 3001 is available
   - Verify CORS settings for browser connections

3. **Memory Store Full**
   - Increase `MEMORY_MAX_SIZE` in configuration
   - Implement periodic cleanup

4. **MCP Server Not Starting**
   - Check MCP server command is correct
   - Verify server dependencies are installed
   - Review `/stats/mcp` for error details

### Debug Mode

```bash
NODE_ENV=development bun run dev
```

This enables:

- Enhanced error messages
- Request/response logging
- WebSocket message tracing
- Memory usage reporting
- MCP connection debugging

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
   - Metrics collection (see `/stats` endpoints)
   - Performance profiling
   - Error tracking

## Support & Resources

- **API Documentation**: <http://localhost:3000/swagger>
- **Dashboard**: <http://localhost:3000/dashboard>
- **Health Check**: <http://localhost:3000/health>
- **Documentation**: `/docs/README.md`
