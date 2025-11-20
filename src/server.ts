/**
 * AI Agents Server - Proper Integration with RAG System
 * Using Bun's native serve with Elysia routes integration
 * Includes client build system and comprehensive RAG capabilities
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import type { Server, ServerWebSocket } from 'bun';
import { serve } from 'bun';
import { Elysia } from 'elysia';

import { config } from '~/lib/server/config';
import { createAIAgentsState } from './core/elysia-state';
import { createMCPManager } from './core/mcp';
import { buildClient } from './lib/build-client';
import { createSwaggerConfig } from './lib/swagger-config';
import type { MainRagService } from './rag';
import { bootstrapRagSystemWithValidation } from './rag';
import { dashboardDataRoutes } from './routes/api/dashboard';
import { mcpRoutes } from './routes/api/mcp';
import { canvasRoutes } from './routes/api/canvas';
import { canvasPageRoutes } from './routes/pages/canvas';
import { agentsPageRoutes } from './routes/pages/agents';
import { toolsPageRoutes } from './routes/pages/tools';
import { chatPageRoutes } from './routes/pages/chat';
import { nodesPageRoutes } from './routes/pages/nodes';
import { openaiRoutes } from './routes/api/openai';
import { aiRoutes } from './routes/api/ai';
import { createRagRoutes } from './routes/api/rag';
import { databaseRoutes } from './routes/api/database';
import { dashboardPageRoutes } from '~/routes/pages/dashboard';

// ============================================================================
// Client Build Helper
// ============================================================================

function getClientFilename(): string {
  try {
    const manifestPath = join(process.cwd(), 'public', 'manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      return manifest.clientJs || 'client.js';
    }
  } catch (error) {
    console.error('Error reading manifest:', error);
  }
  return 'client.js';
}

// ============================================================================
// RAG System Integration
// ============================================================================

// Initialize RAG system
let ragService: MainRagService;

// Initialize MCP Manager
const mcpManager = createMCPManager();

// ============================================================================
// Elysia App with Routes
// ============================================================================

const app = new Elysia()
  .use(cors())
  .use(swagger(createSwaggerConfig(config)))
  .use(createAIAgentsState(config))

  // Dashboard - Main page with API statistics
  .get(
    '/',
    async (context: any) => {
      const { getServerStats } = context;
      const stats = getServerStats();

      // Get RAG system health if available
      let ragHealth = null;
      if (ragService) {
        try {
          ragHealth = await ragService.healthCheck();
        } catch {
          ragHealth = { status: 'unhealthy', error: 'Health check failed' };
        }
      }

      return {
        title: 'AgentCanvas Server Dashboard',
        description:
          'Real-time API usage statistics and server monitoring for AgentCanvas',
        version: '1.0.0',
        product: 'AgentCanvas',
        uptime: Math.floor(stats.uptime || 0),
        statistics: {
          totalRequests: stats.requests || 0,
          activeAgents: stats.agents || 0,
          totalTokensUsed: stats.tokensUsed || 0,
          averageResponseTime: stats.averageResponseTime || 0,
          errorRate: stats.errorRate || 0,
          activeConnections: stats.connections || 0,
          webhookSubscriptions: 0, // This would come from webhook manager
        },
        health: {
          status: 'healthy',
          openaiEnabled: stats.features?.openaiEnabled || false,
          ragEnabled: !!ragService,
          ragStatus: ragHealth?.status || 'disabled',
          debugMode: stats.features?.debugMode || false,
          lastUpdate: new Date().toISOString(),
        },
        endpoints: {
          api: '/api',
          docs: '/docs',
          canvas: '/v1/canvas/*',
          openai: '/v1/openai/*',
          ai: '/v1/ai/*',
          rag: '/v1/rag/*',
          database: '/v1/database/*',
          webhooks: '/webhooks/ws',
        },
        ragSystem: ragService
          ? {
              enabled: true,
              status: ragHealth?.status || 'unknown',
              dualDatabase: {
                postgresql: {
                  enabled: true,
                  status: 'healthy',
                  features: [
                    'pgvector',
                    'semantic_search',
                    'traditional_queries',
                  ],
                },
                neo4j: {
                  enabled: true,
                  status: 'healthy',
                  features: [
                    'graph_traversal',
                    'relationship_analysis',
                    'centrality_metrics',
                  ],
                },
                router: {
                  enabled: true,
                  strategies: ['vector_first', 'graph_first', 'adaptive'],
                  activeStrategy: 'adaptive',
                },
              },
              strategies: [
                'retrieve_read',
                'hybrid',
                'two_stage_rerank',
                'fusion_in_decoder',
                'augmented_reranking',
                'federated',
                'graph_rag',
                'adaptive',
              ],
            }
          : {
              enabled: false,
              reason:
                'RAG system not initialized - check DATABASE_URL and dependencies',
            },
      };
    },
    {
      detail: {
        tags: ['Introduction'],
        summary: 'AgentCanvas Dashboard',
        description:
          'Real-time dashboard for AgentCanvas with API usage statistics and system health',
      },
    }
  )

  // API Information endpoint
  .get(
    '/api',
    () => ({
      title: 'AgentCanvas API',
      description:
        'AgentCanvas - The Agentic Flow Platform. Create, manage, and execute sophisticated agentic flows using OpenAI and Vercel AI SDKs with GraphRAG.',
      version: '1.0.0',
      endpoints: {
        canvas: '/v1/canvas/*',
        openai: '/v1/openai/*',
        ai: '/v1/ai/*',
        rag: '/v1/rag/*',
        database: '/v1/database/*',
        webhooks: '/webhooks/ws',
        docs: '/docs',
      },
      capabilities: [
        'Agentic Flow Creation (AgentCanvas)',
        'Multi-SDK Support (OpenAI & Vercel AI)',
        'GraphRAG with Neo4j & Vercel AI SDK',
        'Dual-database RAG architecture (PostgreSQL + Neo4j)',
        'Intelligent Database Routing',
        'Real-time Streaming & Dashboard Updates',
        'Expert Agent Orchestration',
        'Shared Tool Ecosystem',
      ],
    }),
    {
      detail: {
        tags: ['Introduction'],
        summary: 'AgentCanvas API Info',
        description:
          'Get AgentCanvas API information, available endpoints, and system capabilities',
      },
    }
  )

  // AgentCanvas API Routes
  .use(canvasRoutes)

  // AgentCanvas UI Pages
  .use(canvasPageRoutes)
  .use(agentsPageRoutes)
  .use(toolsPageRoutes)
  .use(chatPageRoutes)
  .use(nodesPageRoutes)

  // OpenAI Agent routes
  .use(openaiRoutes)

  // Custom AI Agent routes
  .use(aiRoutes)

  // Add RAG routes
  .use(createRagRoutes(() => ragService))

  // Simple dual-database documentation and status
  .use(databaseRoutes)

  // MCP Routes Integration
  .use(mcpRoutes.decorate('mcpManager', mcpManager))

  // Dashboard Routes Integration
  .use(dashboardPageRoutes)
  .use(dashboardDataRoutes.decorate('mcpManager', mcpManager));

// ============================================================================
// WebSocket Interface
// ============================================================================

interface ClientData {
  clientId: string;
  joinedAt: string;
  userId?: string;
}

interface ParsedMessage {
  type?: string;
  userId?: string;
  text?: string;
  [key: string]: unknown;
}

// ============================================================================
// Main Server Function
// ============================================================================

async function startServer() {
  // Build client if not in test environment
  if (config.environment !== 'test') {
    try {
      console.log('🔨 Building client assets...');
      await buildClient();
    } catch (error) {
      console.error('❌ Client build failed:', error);
      process.exit(1);
    }
  }

  // Initialize RAG System
  try {
    console.log('🧠 Initializing RAG system...');
    ragService = await bootstrapRagSystemWithValidation({
      databaseUrl: process.env.DATABASE_URL,
      embeddingModel: 'all-MiniLM-L6-v2',
      defaultStrategy: 'retrieve_read',
      defaultTopK: 5,
      scoreThreshold: 0.5,
    });
    console.log('✅ RAG system initialized successfully');
  } catch (error) {
    console.warn('⚠️  RAG system initialization failed:', error);
    console.warn(
      '🔧 RAG endpoints will be disabled. Check DATABASE_URL and dependencies.'
    );
    // Continue without RAG system - server can still function
  }

  const serverOptions = {
    async fetch(req: Request, server: Server<any>): Promise<Response> {
      const url = new URL(req.url);

      // WebSocket upgrade endpoint
      if (url.pathname === '/webhooks/ws') {
        const upgraded = server.upgrade(req, {
          data: {
            clientId: crypto.randomUUID(),
            joinedAt: new Date().toISOString(),
          },
        } as any);

        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 400 });
        }

        return new Response();
      }

      // Reverse proxy: /docs -> /swagger
      if (url.pathname === '/docs') {
        const swaggerUrl = new URL(req.url);
        swaggerUrl.pathname = '/swagger';
        const swaggerRequest = new Request(swaggerUrl, req);
        return await app.handle(swaggerRequest);
      }

      // Serve static files from /public
      if (
        url.pathname.startsWith('/public/') ||
        url.pathname === '/favicon.ico'
      ) {
        const publicPath = join(
          process.cwd(),
          'public',
          url.pathname.replace('/public/', '')
        );
        if (existsSync(publicPath)) {
          const file = Bun.file(publicPath);
          return new Response(file);
        }
      }

      // Serve client JavaScript files
      if (url.pathname.startsWith('/client')) {
        try {
          const requestedFile = url.pathname.replace(/^\/+/, '');
          const publicDir = join(process.cwd(), 'public');
          const specificFilePath = join(publicDir, requestedFile);

          // Security: Reject path traversal attempts
          if (!specificFilePath.startsWith(publicDir)) {
            return new Response('Forbidden', { status: 403 });
          }

          // Determine content type based on file extension
          const contentType = url.pathname.endsWith('.css')
            ? 'text/css'
            : 'application/javascript';

          if (existsSync(specificFilePath)) {
            const file = Bun.file(specificFilePath);
            return new Response(file, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'max-age=3600',
              },
            });
          }

          // Fallback to current client JS file for .js requests
          if (url.pathname.endsWith('.js')) {
            const currentClientJs = getClientFilename();
            const filePath = join(publicDir, currentClientJs);
            if (existsSync(filePath)) {
              const file = Bun.file(filePath);
              return new Response(file, {
                headers: {
                  'Content-Type': 'application/javascript',
                  'Cache-Control': 'max-age=3600',
                },
              });
            }
          }

          return new Response('Client file not found', { status: 404 });
        } catch (error) {
          console.error('Error serving client file:', error);
          return new Response('File not found', { status: 404 });
        }
      }

      // Handle all other requests through Elysia
      try {
        return await app.handle(req);
      } catch (error) {
        console.error('Elysia handler error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    },

    websocket: {
      open(ws: ServerWebSocket<ClientData>) {
        console.log(`WebSocket connection opened: ${ws.data.clientId}`);
        ws.send(
          JSON.stringify({
            type: 'connection',
            message: 'Connected to AI Agents Server',
            clientId: ws.data.clientId,
          })
        );
      },

      message(ws: ServerWebSocket<ClientData>, message: string) {
        try {
          const parsedMessage = JSON.parse(message) as ParsedMessage;

          if (parsedMessage.type === 'subscribe' && parsedMessage.userId) {
            ws.data.userId = parsedMessage.userId;
            ws.send(
              JSON.stringify({
                type: 'subscribed',
                message: `Subscribed to events for user ${parsedMessage.userId}`,
              })
            );
          } else if (parsedMessage.type === 'ping') {
            ws.send(
              JSON.stringify({
                type: 'pong',
                timestamp: Date.now(),
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
              })
            );
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
            })
          );
        }
      },

      close(ws: ServerWebSocket<ClientData>) {
        console.log(`WebSocket connection closed: ${ws.data.clientId}`);
      },
    },

    port: config.port,
    hostname: '0.0.0.0', // Bind to all interfaces
    development: config.environment === 'development',
  } as const;

  const server = serve(serverOptions);

  console.log('🚀 AI Agents Server is starting up...');
  console.log(`📡 Server running at http://localhost:${server.port}`);
  console.log(`🏠 Dashboard available at http://localhost:${server.port}/`);
  console.log(
    `📚 API documentation available at http://localhost:${server.port}/docs`
  );
  console.log(
    `🔗 WebSocket endpoint: ws://localhost:${server.port}/webhooks/ws`
  );
  console.log(`🌐 Accessible externally at http://<your-ip>:${server.port}/`);

  if (config.openai.apiKey) {
    console.log('✅ OpenAI integration enabled');
  } else {
    console.log('⚠️  OpenAI integration disabled (no API key provided)');
  }

  if (ragService) {
    console.log('✅ Dual-database RAG system enabled (PostgreSQL + Neo4j)');
    console.log(
      `🧠 RAG endpoints available at http://localhost:${server.port}/v1/rag/*`
    );
    console.log(
      `🗄️  Database monitoring at http://localhost:${server.port}/v1/database/*`
    );
    console.log('   • PostgreSQL with pgvector for semantic search');
    console.log('   • Neo4j for graph relationships and analytics');
    console.log('   • Intelligent routing with adaptive strategies');
  } else {
    console.log('⚠️  RAG system disabled (initialization failed)');
  }

  console.log('🟢 Server ready to accept connections!');

  return server;
}

// Start server if not in test environment
if (config.environment !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { startServer, app };
