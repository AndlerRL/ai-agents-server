# Model Context Protocol (MCP) Integration Guide

## Overview

The AI Agents Server now supports the **Model Context Protocol (MCP)**, enabling seamless integration of external tools, data sources, and services with both OpenAI and Vercel AI SDK agents.

## Table of Contents

1. [What is MCP?](#what-is-mcp)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Creating MCP Servers](#creating-mcp-servers)
5. [Agent Integration](#agent-integration)
6. [WebSocket Events](#websocket-events)
7. [API Reference](#api-reference)
8. [Examples](#examples)
9. [Best Practices](#best-practices)

## What is MCP?

The Model Context Protocol (MCP) is an open protocol that standardizes how AI applications communicate with external data sources and tools. MCP servers expose:

- **Tools**: Functions that agents can call (file operations, API calls, etc.)
- **Prompts**: Pre-defined prompt templates
- **Resources**: Data sources (files, databases, APIs)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              AI Agents Server                       │
│                                                     │
│  ┌──────────────┐          ┌──────────────┐         │
│  │ OpenAI Agent │          │ Vercel Agent │         │
│  │  (gpt-4o)    │          │  (claude-3)  │         │
│  └──────┬───────┘          └──────┬───────┘         │
│         │                          │                │
│         └───────────┬──────────────┘                │
│                     │                               │
│              ┌──────▼──────┐                        │
│              │ MCP Manager │                        │
│              └──────┬──────┘                        │
│                     │                               │
│         ┌───────────┼───────────┐                   │
│         │           │           │                   │
│    ┌────▼────┐ ┌───▼────┐ ┌───▼────┐                │
│    │  MCP    │ │  MCP   │ │  MCP   │                │
│    │ Server  │ │ Server │ │ Server │                │
│    │   #1    │ │   #2   │ │   #3   │                │
│    └─────────┘ └────────┘ └────────┘                │
│    FileSystem    GitHub     Custom                  │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start an MCP Server

```bash
curl -X POST http://localhost:3001/mcp/servers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "filesystem",
    "name": "File System Server",
    "description": "Access local file system",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
    "transport": "stdio",
    "autoRestart": true
  }'
```

### 2. Create an Agent with MCP

```bash
curl -X POST http://localhost:3001/mcp/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "name": "File Assistant",
      "model": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "config": {}
      },
      "tools": [],
      "memory": {},
      "status": "idle"
    },
    "mcpServers": ["filesystem"],
    "sdkType": "openai",
    "autoImportTools": true,
    "toolPrefix": "fs_"
  }'
```

### 3. Execute MCP Tools

```bash
curl -X POST http://localhost:3001/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "read_file",
    "parameters": {
      "path": "/path/to/file.txt"
    },
    "serverId": "filesystem",
    "agentId": "agent-123"
  }'
```

## Creating MCP Servers

### Official MCP Servers

Use pre-built MCP servers from the ecosystem:

#### File System Server

```json
{
  "id": "filesystem",
  "name": "File System",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
  "description": "Read, write, and manage files"
}
```

#### GitHub Server

```json
{
  "id": "github",
  "name": "GitHub Integration",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "your-token-here"
  },
  "description": "Interact with GitHub repositories"
}
```

#### Brave Search Server

```json
{
  "id": "brave-search",
  "name": "Web Search",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "your-api-key"
  },
  "description": "Search the web"
}
```

### Custom MCP Server

Create your own MCP server using the SDK:

```typescript
// my-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: 'my-custom-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define a tool
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'greet',
        description: 'Greet someone',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name to greet'
            }
          },
          required: ['name']
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'greet') {
    const name = request.params.arguments?.name;
    return {
      content: [
        {
          type: 'text',
          text: `Hello, ${name}!`
        }
      ]
    };
  }
  
  throw new Error('Unknown tool');
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

Register your custom server:

```json
{
  "id": "custom",
  "name": "Custom MCP Server",
  "command": "bun",
  "args": ["run", "./my-mcp-server.ts"],
  "description": "My custom tools"
}
```

## Agent Integration

### OpenAI SDK Integration

MCP tools are automatically converted to OpenAI function calls:

```typescript
// Create agent with MCP tools
const agent = await createMCPAgent({
  agent: {
    name: 'OpenAI Assistant',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      config: { temperature: 0.7 }
    },
    tools: [],
    memory: memoryStore,
    status: 'idle'
  },
  mcpServers: ['filesystem', 'github'],
  sdkType: 'openai',
  autoImportTools: true,
  toolPrefix: 'mcp_'
});

// Agent can now use MCP tools automatically
// Example: "Read the README.md file"
// Will call: mcp_read_file({ path: 'README.md' })
```

### Vercel AI SDK Integration

MCP tools work seamlessly with Vercel AI SDK:

```typescript
import { generateText, tool } from 'ai';

// Create agent with MCP tools
const agent = await createMCPAgent({
  agent: {
    name: 'Vercel Assistant',
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      config: {}
    },
    tools: [],
    memory: memoryStore,
    status: 'idle'
  },
  mcpServers: ['filesystem'],
  sdkType: 'vercel',
  autoImportTools: true
});

// Use with Vercel AI SDK
const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'List all files in the current directory',
  tools: {
    // MCP tools are automatically added
    ...agent.tools
  }
});
```

## WebSocket Events

Subscribe to real-time MCP events:

```javascript
const ws = new WebSocket('ws://localhost:3001/webhooks/ws');

ws.onopen = () => {
  // Subscribe to MCP events
  ws.send(JSON.stringify({
    type: 'subscribe',
    events: [
      'mcp.server.started',
      'mcp.server.stopped',
      'mcp.tool.executed',
      'mcp.agent.created'
    ]
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'data') {
    const mcpEvent = data.data;
    console.log('MCP Event:', mcpEvent);
    
    switch (mcpEvent.type) {
      case 'mcp.server.started':
        console.log('Server started:', mcpEvent.payload.serverId);
        break;
      case 'mcp.tool.executed':
        console.log('Tool executed:', mcpEvent.payload.toolName);
        break;
      case 'mcp.agent.created':
        console.log('Agent created:', mcpEvent.payload.agentId);
        break;
    }
  }
};
```

## API Reference

### MCP Server Endpoints

#### `POST /mcp/servers` - Start MCP Server

Start a new MCP server instance.

**Request Body:**

```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "command": "string",
  "args": ["string"],
  "env": { "key": "value" },
  "transport": "stdio" | "sse" | "websocket",
  "timeout": 30000,
  "autoRestart": true,
  "maxRestarts": 3
}
```

#### `GET /mcp/servers` - List Servers

Get all registered MCP servers.

#### `GET /mcp/servers/:id` - Get Server

Get a specific MCP server by ID.

#### `POST /mcp/servers/:id/restart` - Restart Server

Restart an MCP server.

#### `DELETE /mcp/servers/:id` - Stop Server

Stop and remove an MCP server.

### Tool Endpoints

#### `GET /mcp/tools` - List Tools

Get available tools from MCP servers.

**Query Parameters:**

- `serverId` (optional): Filter by server ID

#### `POST /mcp/tools/execute` - Execute Tool

Execute a tool from an MCP server.

**Request Body:**

```json
{
  "tool": "string",
  "parameters": {},
  "serverId": "string",
  "agentId": "string"
}
```

### Agent Endpoints

#### `POST /mcp/agents` - Create MCP Agent

Create an agent with MCP server integration.

**Request Body:**

```json
{
  "agent": {
    "name": "string",
    "model": {
      "provider": "openai" | "anthropic" | "custom",
      "model": "string",
      "config": {}
    },
    "tools": [],
    "memory": {},
    "status": "idle"
  },
  "mcpServers": ["server-id-1", "server-id-2"],
  "sdkType": "openai" | "vercel",
  "autoImportTools": true,
  "toolPrefix": "mcp_"
}
```

#### `GET /mcp/agents/:id/servers` - Get Agent Servers

Get MCP servers associated with an agent.

### Statistics

#### `GET /mcp/stats` - MCP Statistics

Get MCP system statistics.

**Response:**

```json
{
  "totalServers": 3,
  "activeServers": 2,
  "failedServers": 1,
  "totalTools": 15,
  "totalPrompts": 5,
  "totalResources": 8,
  "totalToolCalls": 142,
  "totalMCPAgents": 4,
  "averageToolExecutionTime": 234.5
}
```

## Examples

### Example 1: File Management Agent

```typescript
// 1. Start filesystem server
await fetch('http://localhost:3001/mcp/servers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'files',
    name: 'File System',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
    description: 'Manage project files'
  })
});

// 2. Create agent with file tools
const agent = await fetch('http://localhost:3001/mcp/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: {
      name: 'File Manager',
      model: { provider: 'openai', model: 'gpt-4o-mini', config: {} },
      tools: [],
      memory: {},
      status: 'idle'
    },
    mcpServers: ['files'],
    sdkType: 'openai',
    autoImportTools: true
  })
}).then(r => r.json());

// 3. Agent can now manage files automatically
// "List all TypeScript files"
// "Read the package.json file"
// "Create a new file called test.txt"
```

### Example 2: GitHub Integration Agent

```typescript
// 1. Start GitHub server
await fetch('http://localhost:3001/mcp/servers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'github',
    name: 'GitHub',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN },
    description: 'GitHub operations'
  })
});

// 2. Create GitHub assistant
const agent = await fetch('http://localhost:3001/mcp/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: {
      name: 'GitHub Assistant',
      model: { provider: 'openai', model: 'gpt-4o', config: {} },
      tools: [],
      memory: {},
      status: 'idle'
    },
    mcpServers: ['github'],
    sdkType: 'openai',
    autoImportTools: true,
    toolPrefix: 'gh_'
  })
}).then(r => r.json());

// 3. Use for GitHub operations
// "Create an issue in my repo"
// "List recent pull requests"
// "Get repository statistics"
```

### Example 3: Multi-Server Agent

```typescript
// 1. Start multiple servers
const servers = [
  {
    id: 'files',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
  },
  {
    id: 'github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
  },
  {
    id: 'search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY }
  }
];

for (const server of servers) {
  await fetch('http://localhost:3001/mcp/servers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...server,
      name: server.id,
      description: `${server.id} operations`
    })
  });
}

// 2. Create super-agent with all capabilities
const agent = await fetch('http://localhost:3001/mcp/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agent: {
      name: 'Super Assistant',
      model: { provider: 'openai', model: 'gpt-4o', config: {} },
      tools: [],
      memory: {},
      status: 'idle'
    },
    mcpServers: ['files', 'github', 'search'],
    sdkType: 'openai',
    autoImportTools: true
  })
}).then(r => r.json());

// 3. Agent can now:
// - Search the web
// - Manage files
// - Work with GitHub
// - All in one conversation!
```

## Best Practices

### 1. Server Lifecycle Management

```typescript
// Always enable auto-restart for production
{
  "autoRestart": true,
  "maxRestarts": 3,
  "timeout": 30000
}

// Monitor server health via WebSocket events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'mcp.server.error') {
    console.error('Server error:', data.payload);
    // Alert ops team
  }
};
```

### 2. Tool Organization

```typescript
// Use prefixes for multi-server agents
{
  "toolPrefix": "fs_",  // fs_read_file, fs_write_file
  "autoImportTools": true
}

// Keep server responsibilities focused
// Good: One server for files, one for GitHub
// Bad: One server that does everything
```

### 3. Security

```typescript
// Use environment variables for sensitive data
{
  "env": {
    "GITHUB_TOKEN": process.env.GITHUB_TOKEN,
    "API_KEY": process.env.API_KEY
  }
}

// Limit file system access
{
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/safe/directory"  // Restrict to specific directory
  ]
}
```

### 4. Performance

```typescript
// Monitor tool execution times
const stats = await fetch('http://localhost:3001/mcp/stats')
  .then(r => r.json());

console.log('Average execution time:', stats.averageToolExecutionTime);

// Set reasonable timeouts
{
  "timeout": 30000  // 30 seconds
}
```

### 5. Error Handling

```typescript
// Always handle tool execution errors
try {
  const result = await fetch('http://localhost:3001/mcp/tools/execute', {
    method: 'POST',
    body: JSON.stringify({ tool: 'risky_operation', ... })
  });
  
  if (!result.ok) {
    // Handle error gracefully
    console.error('Tool execution failed');
  }
} catch (error) {
  // Server or network error
  console.error('Request failed:', error);
}
```

## Troubleshooting

### Server Won't Start

1. Check server command and arguments
2. Verify environment variables
3. Check file permissions
4. Review server logs via WebSocket events

### Tools Not Available

1. Verify server status: `GET /mcp/servers/:id`
2. Check server capabilities
3. Ensure server is in 'ready' state
4. Restart server if needed

### Agent Can't Use Tools

1. Verify `autoImportTools: true`
2. Check agent's MCP servers: `GET /mcp/agents/:id/servers`
3. Ensure server is active
4. Check tool names and parameters

## Additional Resources

- [MCP Official Documentation](https://modelcontextprotocol.io)
- [MCP SDK on GitHub](https://github.com/modelcontextprotocol/sdk)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)
- [AI Agents Server Documentation](./README.md)

## Support

For issues and questions:

- GitHub Issues: [Report a bug](https://github.com/AndlerRL/ai-agents-server/issues)
- Documentation: [Full docs](./README.md)
- WebSocket Events: Monitor real-time at `ws://localhost:3001/webhooks/ws`
