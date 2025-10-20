/**
 * AI Agents Server - Proper Integration with RAG System
 * Using Bun's native serve with Elysia routes integration
 * Includes client build system and comprehensive RAG capabilities
 */

import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import type { Server, ServerWebSocket } from 'bun'
import { serve } from 'bun'
import { Elysia } from 'elysia'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { config } from '~/lib/server/config'
import { createAIAgentsState } from './core/elysia-state'
import { createMCPManager } from './core/mcp'
import { buildClient } from './lib/build-client'
import { dashboardRouteOptions, getDashboardDataHandler } from './lib/server/dashboard-data'
import { createSwaggerConfig } from './lib/swagger-config'
import type { MainRagService } from './rag'
import { bootstrapRagSystemWithValidation } from './rag'
import { createDashboardRoutes } from './routes/dashboard'
import { createMCPRoutes } from './routes/mcp'

// ============================================================================
// Client Build Helper
// ============================================================================

function getClientFilename(): string {
  try {
    const manifestPath = join(process.cwd(), 'public', 'manifest.json')
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      return manifest.clientJs || 'client.js'
    }
  } catch (error) {
    console.error('Error reading manifest:', error)
  }
  return 'client.js'
}

// ============================================================================
// Elysia App with Routes
// ============================================================================

let app = new Elysia()
  .use(cors())
  .use(swagger(createSwaggerConfig(config)))
  .use(createAIAgentsState(config))
  
  // API Information endpoint
  .get('/api', () => ({
    title: 'AI Agents Server API',
    description: 'Sophisticated agentic AI server using ElysiaJS, OpenAI, Vercel AI SDK, and RAG systems',
    version: '1.0.0',
    endpoints: {
      openai: '/v1/openai/*',
      ai: '/v1/ai/*',
      rag: '/v1/rag/*',
      mcp: '/api/mcp/*',
      webhooks: '/webhooks/ws',
      docs: '/docs'
    },
    capabilities: [
      'OpenAI agent integration',
      'Vercel AI SDK streaming',
      'RAG with multiple strategies',
      'Real-time WebSocket events',
      'pgvector database support',
      'Adaptive retrieval granularity',
      'Model Context Protocol (MCP) servers',
      'MCP tool execution and prompts'
    ]
  }), {
    detail: {
      tags: ['Introduction'],
      summary: 'API information',
      description: 'Get API server information, available endpoints, and system capabilities'
    }
  })
  
  // OpenAI Agent routes - /v1/openai/*
  .group('/v1/openai', (app) => app
    .get('/', () => ({
      title: 'OpenAI Agents API',
      description: 'OpenAI agent integration with chat completions and tool calling',
      version: '1.0.0',
      endpoints: {
        agents: '/v1/openai/agents',
        chat: '/v1/openai/chat',
        models: '/v1/openai/models',
        tools: '/v1/openai/tools'
      }
    }), {
      detail: {
        tags: ['OpenAI Agents'],
        summary: 'OpenAI API information',
        description: 'Get OpenAI agent integration information and available endpoints'
      }
    })
    
    // Agent management
    .group('/agents', (app) => app
      .get('/', ({ getAllAgents }: any) => {
        return {
          success: true,
          data: getAllAgents()
        }
      }, {
        detail: {
          tags: ['OpenAI Agents'],
          summary: 'List all OpenAI agents',
          description: 'Retrieve all OpenAI agents with their current status and configuration'
        }
      })
      
      .post('/', async ({ body, createAgent, incrementAgents }: any) => {
        try {
          const agent = await createAgent(body)
          incrementAgents()
          return {
            success: true,
            data: agent
          }
        } catch (error) {
          return {
            success: false,
            error: 'Failed to create agent',
            message: String(error)
          }
        }
      }, {
        detail: {
          tags: ['OpenAI Agents'],
          summary: 'Create new OpenAI agent',
          description: 'Create a new OpenAI agent with specified configuration',
          body: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Agent name' },
              model: { type: 'string', default: 'gpt-4o-mini' },
              tools: { type: 'array', items: { type: 'string' } },
              config: { type: 'object' }
            },
            required: ['name']
          }
        }
      })
    )
    
    // Chat completions
    .group('/chat', (app) => app
      .post('/completions', async ({ body, chatWithAgent, addTokenUsage }: any) => {
        try {
          const { model = 'gpt-4o-mini', messages, ...options } = body
          
          const response = await chatWithAgent(model, messages, options)
          addTokenUsage(response.metadata.tokensUsed)
          
          return {
            success: true,
            data: response
          }
        } catch (error) {
          return {
            success: false,
            error: 'Chat completion failed',
            message: String(error)
          }
        }
      }, {
        detail: {
          tags: ['OpenAI Agents'],
          summary: 'OpenAI chat completion',
          description: 'Generate chat completions using OpenAI models with agent context',
          body: {
            $ref: '#/components/schemas/ChatRequest'
          }
        }
      })
    )
  )
  
  // Custom AI Agent routes - /v1/ai/*
  .group('/v1/ai', (app) => app
    .get('/', () => ({
      title: 'Custom AI Agents API',
      description: 'Custom AI agent server using Vercel AI SDK',
      version: '1.0.0',
      endpoints: {
        agents: '/v1/ai/agents',
        chat: '/v1/ai/chat',
        stream: '/v1/ai/stream'
      }
    }), {
      detail: {
        tags: ['Custom AI'],
        summary: 'Custom AI API information',
        description: 'Get custom AI agent integration information using Vercel AI SDK'
      }
    })
    
    .group('/chat', (app) => app
      .post('/stream', async ({ body, chatWithAgent }: any) => {
        try {
          const { model = 'gpt-4o-mini', messages, stream = true } = body
          
          if (stream) {
            const response = await chatWithAgent(model, messages, { stream: true })
            return new Response(response.stream, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              }
            })
          } else {
            const response = await chatWithAgent(model, messages, { stream: false })
            return {
              success: true,
              data: response
            }
          }
        } catch (error) {
          return {
            success: false,
            error: 'AI chat failed',
            message: String(error)
          }
        }
      }, {
        detail: {
          tags: ['Custom AI'],
          summary: 'Streaming AI chat',
          description: 'Generate streaming chat responses using Vercel AI SDK with real-time token streaming',
          body: {
            type: 'object',
            properties: {
              model: { type: 'string', default: 'gpt-4o-mini' },
              messages: {
                type: 'array',
                items: { $ref: '#/components/schemas/ChatMessage' }
              },
              stream: { type: 'boolean', default: true, description: 'Enable streaming response' },
              temperature: { type: 'number', minimum: 0, maximum: 2 },
              maxTokens: { type: 'integer', minimum: 1 }
            },
            required: ['messages']
          }
        }
      })
    )
  )

// ============================================================================
// RAG System Integration
// ============================================================================

// Initialize RAG system
let ragService: MainRagService

// Initialize MCP Manager
const mcpManager = createMCPManager()

// Add RAG routes
app.group('/v1/rag', (app) => app
  .get('/', () => ({
    title: 'RAG System API',
    description: 'Retrieval-Augmented Generation with multiple strategies and pgvector database',
    version: '1.0.0',
    endpoints: {
      retrieve: '/v1/rag/retrieve',
      documents: '/v1/rag/documents',
      health: '/v1/rag/health',
      metrics: '/v1/rag/metrics'
    },
    strategies: [
      'retrieve_read',
      'hybrid',
      'two_stage_rerank', 
      'fusion_in_decoder',
      'augmented_reranking',
      'federated',
      'graph_rag',
      'adaptive'
    ]
  }), {
    detail: {
      tags: ['RAG System'],
      summary: 'RAG API information',
      description: 'Get RAG system information and available endpoints'
    }
  })

  // Main retrieval endpoint
  .post('/retrieve', async ({ body }: any) => {
    try {
      if (!ragService) {
        return {
          success: false,
          error: 'RAG system not initialized',
          message: 'RAG service is not available'
        }
      }

      const { query, strategy, topK, granularity, includeMetadata, filters } = body
      
      if (!query) {
        return {
          success: false,
          error: 'Missing query',
          message: 'Query text is required'
        }
      }

      const ragQuery = {
        text: query,
        strategy,
        topK: topK || 5,
        granularity: granularity || 'coarse',
        includeMetadata: includeMetadata || false,
        filters,
        queryId: crypto.randomUUID(),
        clientId: 'web-client',
        metadata: {
          requestId: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }
      }

      const response = await ragService.retrieve(ragQuery)

      return {
        success: true,
        data: response
      }
    } catch (error) {
      console.error('RAG retrieval error:', error)
      return {
        success: false,
        error: 'RAG retrieval failed',
        message: String(error)
      }
    }
  }, {
    detail: {
      tags: ['RAG System'],
      summary: 'Retrieve documents',
      description: 'Retrieve relevant documents using RAG system with various strategies',
      body: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query text' },
          strategy: { 
            type: 'string', 
            enum: ['retrieve_read', 'hybrid', 'two_stage_rerank', 'fusion_in_decoder', 'augmented_reranking', 'federated', 'graph_rag', 'adaptive'],
            description: 'Retrieval strategy to use'
          },
          topK: { type: 'integer', minimum: 1, maximum: 50, default: 5, description: 'Number of results to return' },
          granularity: { type: 'string', enum: ['coarse', 'fine', 'adaptive'], default: 'coarse', description: 'Chunk granularity' },
          includeMetadata: { type: 'boolean', default: false, description: 'Include additional metadata' },
          filters: {
            type: 'object',
            properties: {
              dateRange: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date-time' },
                  end: { type: 'string', format: 'date-time' }
                }
              },
              sources: { type: 'array', items: { type: 'string' } },
              contentTypes: { type: 'array', items: { type: 'string' } },
              languages: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ['query']
      }
    }
  })

  // Adaptive retrieval
  .post('/adaptive', async ({ body }: any) => {
    try {
      if (!ragService) {
        return {
          success: false,
          error: 'RAG system not initialized'
        }
      }

      const { query, topK, includeMetadata } = body
      
      const ragQuery = {
        text: query,
        topK: topK || 5,
        granularity: 'adaptive' as const,
        includeMetadata: includeMetadata || false,
        queryId: crypto.randomUUID(),
        clientId: 'web-client'
      }

      const response = await ragService.adaptiveRetrieve(ragQuery)

      return {
        success: true,
        data: response,
        explanation: 'Used adaptive strategy selection based on query characteristics'
      }
    } catch (error) {
      return {
        success: false,
        error: 'Adaptive retrieval failed',
        message: String(error)
      }
    }
  }, {
    detail: {
      tags: ['RAG System'],
      summary: 'Adaptive retrieval',
      description: 'Automatically select optimal retrieval strategy based on query characteristics'
    }
  })

  // Document management
  .group('/documents', (app) => app
    .post('/', async ({ body }: any) => {
      try {
        if (!ragService) {
          return { success: false, error: 'RAG system not initialized' }
        }

        const { content, metadata } = body
        const documentId = await ragService.addDocument(content, metadata)

        return {
          success: true,
          data: { documentId },
          message: 'Document added successfully'
        }
      } catch (error) {
        return {
          success: false,
          error: 'Failed to add document',
          message: String(error)
        }
      }
    }, {
      detail: {
        tags: ['RAG System'],
        summary: 'Add document',
        description: 'Add a new document to the RAG system'
      }
    })

    .post('/batch', async ({ body }: any) => {
      try {
        if (!ragService) {
          return { success: false, error: 'RAG system not initialized' }
        }

        const { documents } = body
        const documentIds = await ragService.addDocuments(documents)

        return {
          success: true,
          data: { documentIds },
          message: `Added ${documentIds.length} documents`
        }
      } catch (error) {
        return {
          success: false,
          error: 'Failed to add documents',
          message: String(error)
        }
      }
    })

    .delete('/:id', async ({ params }: any) => {
      try {
        if (!ragService) {
          return { success: false, error: 'RAG system not initialized' }
        }

        await ragService.deleteDocument(params.id)

        return {
          success: true,
          message: 'Document deleted successfully'
        }
      } catch (error) {
        return {
          success: false,
          error: 'Failed to delete document',
          message: String(error)
        }
      }
    })
  )

  // Health and metrics
  .get('/health', async () => {
    try {
      if (!ragService) {
        return {
          status: 'unhealthy',
          error: 'RAG system not initialized'
        }
      }

      const health = await ragService.healthCheck()
      return health
    } catch (error) {
      return {
        status: 'unhealthy',
        error: 'Health check failed',
        message: String(error)
      }
    }
  }, {
    detail: {
      tags: ['RAG System'],
      summary: 'Health check',
      description: 'Check RAG system health status'
    }
  })

  .get('/metrics', async () => {
    try {
      if (!ragService) {
        return { error: 'RAG system not initialized' }
      }

      const [systemMetrics, indexStats] = await Promise.all([
        ragService.getSystemMetrics(),
        ragService.getIndexStats()
      ])

      return {
        success: true,
        data: {
          system: systemMetrics,
          index: indexStats
        }
      }
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get metrics',
        message: String(error)
      }
    }
  }, {
    detail: {
      tags: ['RAG System'],
      summary: 'System metrics',
      description: 'Get RAG system performance metrics and statistics'
    }
  })
)

// ============================================================================
// MCP Routes Integration
// ============================================================================

const mcpRoutes = createMCPRoutes(new Elysia())
app.group('/api/mcp', (app) => app.use(mcpRoutes.decorate('mcpManager', mcpManager)))

// ============================================================================
// Dashboard Routes Integration  
// ============================================================================

// Dashboard routes are added directly to app since they need access to derived state
app = app
  .decorate('mcpManager', mcpManager)
  .get('/', getDashboardDataHandler, dashboardRouteOptions)
  .get('/dashboard', getDashboardDataHandler, {
    detail: {
      tags: ['Dashboard'],
      summary: 'Interactive React dashboard UI (alias)',
      description: 'Alternative route to access the server-side rendered React dashboard'
    }
  })

// Add other dashboard routes (stats, agents, etc.)
const dashboardDataRoutes = createDashboardRoutes(new Elysia())
app = app.use(dashboardDataRoutes.decorate('mcpManager', mcpManager))

// ============================================================================
// WebSocket Interface
// ============================================================================

interface ClientData {
  clientId: string
  joinedAt: string
  userId?: string
}

interface ParsedMessage {
  type?: string
  userId?: string
  text?: string
  [key: string]: unknown
}

// ============================================================================
// Main Server Function
// ============================================================================

async function startServer() {
  // Build client if not in test environment
  if (config.environment !== 'test') {
    try {
      console.log('🔨 Building client assets...')
      await buildClient()
    } catch (error) {
      console.error('❌ Client build failed:', error)
      process.exit(1)
    }
  }

  // Initialize RAG System
  try {
    console.log('🧠 Initializing RAG system...')
    ragService = await bootstrapRagSystemWithValidation({
      databaseUrl: process.env.DATABASE_URL,
      embeddingModel: 'all-MiniLM-L6-v2',
      defaultStrategy: 'retrieve_read',
      defaultTopK: 5,
      scoreThreshold: 0.5
    })
    console.log('✅ RAG system initialized successfully')
  } catch (error) {
    console.warn('⚠️  RAG system initialization failed:', error)
    console.warn('🔧 RAG endpoints will be disabled. Check DATABASE_URL and dependencies.')
    // Continue without RAG system - server can still function
  }

  const serverOptions = {
    async fetch(req: Request, server: Server): Promise<Response> {
      const url = new URL(req.url)

      // WebSocket upgrade endpoint
      if (url.pathname === '/webhooks/ws') {
        const upgraded = server.upgrade<ClientData>(req, {
          data: {
            clientId: crypto.randomUUID(),
            joinedAt: new Date().toISOString(),
          },
        })

        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 400 })
        }

        return new Response()
      }

      // Reverse proxy: /docs -> /swagger
      if (url.pathname === '/docs') {
        const swaggerUrl = new URL(req.url)
        swaggerUrl.pathname = '/swagger'
        const swaggerRequest = new Request(swaggerUrl, req)
        return await app.handle(swaggerRequest)
      }

      // Serve static files from public directory (CSS and JS)
      if (url.pathname.startsWith('/client')) {
        try {
          const requestedFile = url.pathname.replace(/^\/+/, '')
          const publicDir = join(process.cwd(), 'public')
          const specificFilePath = join(publicDir, requestedFile)

          // Security: Reject path traversal attempts
          if (!specificFilePath.startsWith(publicDir)) {
            return new Response('Forbidden', { status: 403 })
          }

          // Determine content type based on file extension
          const contentType = url.pathname.endsWith('.css') 
            ? 'text/css' 
            : 'application/javascript'

          if (existsSync(specificFilePath)) {
            const file = Bun.file(specificFilePath)
            return new Response(file, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'max-age=3600',
              },
            })
          }

          // Fallback to current client JS file for .js requests
          if (url.pathname.endsWith('.js')) {
            const currentClientJs = getClientFilename()
            const filePath = join(publicDir, currentClientJs)
            if (existsSync(filePath)) {
              const file = Bun.file(filePath)
              return new Response(file, {
                headers: {
                  'Content-Type': 'application/javascript',
                  'Cache-Control': 'max-age=3600',
                },
              })
            }
          }

          return new Response('File not found', { status: 404 })
        } catch (error) {
          console.error('Error serving static file:', error)
          return new Response('File not found', { status: 404 })
        }
      }

      // Handle all other requests through Elysia
      try {
        return await app.handle(req)
      } catch (error) {
        console.error('Elysia handler error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    },
    
    websocket: {
      open(ws: ServerWebSocket<ClientData>) {
        console.log(`WebSocket connection opened: ${ws.data.clientId}`)
        ws.send(JSON.stringify({
          type: 'connection',
          message: 'Connected to AI Agents Server',
          clientId: ws.data.clientId
        }))
      },
      
      message(ws: ServerWebSocket<ClientData>, message: string) {
        try {
          const parsedMessage = JSON.parse(message) as ParsedMessage
          
          if (parsedMessage.type === 'subscribe' && parsedMessage.userId) {
            ws.data.userId = parsedMessage.userId
            ws.send(JSON.stringify({
              type: 'subscribed',
              message: `Subscribed to events for user ${parsedMessage.userId}`
            }))
          } else if (parsedMessage.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }))
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid message format'
            }))
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }))
        }
      },
      
      close(ws: ServerWebSocket<ClientData>) {
        console.log(`WebSocket connection closed: ${ws.data.clientId}`)
      },
    },
    
    port: config.port,
    hostname: '0.0.0.0', // Bind to all interfaces
    development: config.environment === 'development',
  } as const

  const server = serve(serverOptions)
  
  console.log('🚀 AI Agents Server is starting up...')
  console.log(`📡 Server running at http://localhost:${server.port}`)
  console.log(`🏠 Dashboard available at http://localhost:${server.port}/`)
  console.log(`📚 API documentation available at http://localhost:${server.port}/docs`)
  console.log(`🔗 WebSocket endpoint: ws://localhost:${server.port}/webhooks/ws`)
  console.log(`🌐 Accessible externally at http://<your-ip>:${server.port}/`)
  
  if (config.openai.apiKey) {
    console.log('✅ OpenAI integration enabled')
  } else {
    console.log('⚠️  OpenAI integration disabled (no API key provided)')
  }
  
  if (ragService) {
    console.log('✅ RAG system enabled with multiple retrieval strategies')
    console.log(`🧠 RAG endpoints available at http://localhost:${server.port}/v1/rag/*`)
  } else {
    console.log('⚠️  RAG system disabled (initialization failed)')
  }
  
  console.log('✅ MCP system enabled for external tool integration')
  console.log(`🔧 MCP endpoints available at http://localhost:${server.port}/api/mcp/*`)
  console.log(`📖 MCP documentation at http://localhost:${server.port}/mcp/docs`)
  
  console.log('🟢 Server ready to accept connections!')
  
  return server
}

// Start server if not in test environment
if (config.environment !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start server:', error)
    process.exit(1)
  })
}

export { app, startServer }

