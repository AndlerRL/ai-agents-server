/**
 * AI Agents Server - Proper Integration
 * Using Bun's native serve with Elysia routes integration
 * Includes client build system like your example
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Server, ServerWebSocket } from 'bun'
import { serve } from 'bun'
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'

import { buildClient } from './lib/build-client'
import { createSwaggerConfig } from './lib/swagger-config'
import { createAIAgentsState } from './core/elysia-state'
import type { ServerConfig } from './core/types'

// ============================================================================
// Server Configuration
// ============================================================================

const config: ServerConfig = {
  environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
  port: parseInt(process.env.PORT || '3001'),
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL,
    organization: process.env.OPENAI_ORGANIZATION
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

const app = new Elysia()
  .use(cors())
  .use(swagger(createSwaggerConfig(config)))
  .use(createAIAgentsState(config))
  
  // Dashboard - Main page with API statistics
  .get('/', ({ getServerStats }: any) => {
    const stats = getServerStats()
    return {
      title: 'AI Agents Server Dashboard',
      description: 'Real-time API usage statistics and server monitoring',
      version: '1.0.0',
      uptime: Math.floor(stats.uptime || 0),
      statistics: {
        totalRequests: stats.requests || 0,
        activeAgents: stats.agents || 0,
        totalTokensUsed: stats.tokensUsed || 0,
        averageResponseTime: stats.averageResponseTime || 0,
        errorRate: stats.errorRate || 0,
        activeConnections: stats.connections || 0,
        webhookSubscriptions: 0 // This would come from webhook manager
      },
      health: {
        status: 'healthy',
        openaiEnabled: stats.features?.openaiEnabled || false,
        debugMode: stats.features?.debugMode || false,
        lastUpdate: new Date().toISOString()
      },
      endpoints: {
        api: '/api',
        docs: '/docs',
        openai: '/v1/openai/*',
        ai: '/v1/ai/*',
        webhooks: '/webhooks/ws'
      }
    }
  }, {
    detail: {
      tags: ['Introduction'],
      summary: 'Server dashboard',
      description: 'Real-time dashboard with API usage statistics, server health, and endpoint information'
    }
  })
  
  // API Information endpoint
  .get('/api', () => ({
    title: 'AI Agents Server API',
    description: 'Sophisticated agentic AI server using ElysiaJS, OpenAI, and Vercel AI SDK',
    version: '1.0.0',
    endpoints: {
      openai: '/v1/openai/*',
      ai: '/v1/ai/*',
      webhooks: '/webhooks/ws',
      docs: '/docs'
    }
  }), {
    detail: {
      tags: ['Introduction'],
      summary: 'API information',
      description: 'Get API server information and available endpoints'
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

      // Serve static files from /public
      if (url.pathname.startsWith('/public/') || url.pathname === '/favicon.ico') {
        const publicPath = join(process.cwd(), 'public', url.pathname.replace('/public/', ''))
        if (existsSync(publicPath)) {
          const file = Bun.file(publicPath)
          return new Response(file)
        }
      }

      // Serve client JavaScript files
      if (url.pathname.startsWith('/client') && url.pathname.endsWith('.js')) {
        try {
          const requestedFile = url.pathname.replace(/^\/+/, '')
          const publicDir = join(process.cwd(), 'public')
          const specificFilePath = join(publicDir, requestedFile)

          // Security: Reject path traversal attempts
          if (!specificFilePath.startsWith(publicDir)) {
            return new Response('Forbidden', { status: 403 })
          }

          if (existsSync(specificFilePath)) {
            const file = Bun.file(specificFilePath)
            return new Response(file, {
              headers: {
                'Content-Type': 'application/javascript',
                'Cache-Control': 'max-age=3600',
              },
            })
          }

          // Fallback to current client file
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

          return new Response('Client file not found', { status: 404 })
        } catch (error) {
          console.error('Error serving client file:', error)
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
  console.log(`� Dashboard available at http://localhost:${server.port}/`)
  console.log(`�📚 API documentation available at http://localhost:${server.port}/docs`)
  console.log(`🔗 WebSocket endpoint: ws://localhost:${server.port}/webhooks/ws`)
  console.log(`🌐 Accessible externally at http://<your-ip>:${server.port}/`)
  
  if (config.openai.apiKey) {
    console.log('✅ OpenAI integration enabled')
  } else {
    console.log('⚠️  OpenAI integration disabled (no API key provided)')
  }
  
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

export { startServer, app }
