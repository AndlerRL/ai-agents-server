/**
 * Swagger API Documentation Configuration
 * Comprehensive API documentation for AI Agents Server
 */

import type { ServerConfig } from '../core/types'

export function createSwaggerConfig(config: ServerConfig) {
  return {
    documentation: {
      info: {
        title: 'AI Agents Server API',
        version: '1.0.0',
        description: 'Sophisticated agentic AI server with OpenAI and Vercel AI SDK integration. Provides comprehensive AI agent management, chat completions, streaming responses, and real-time event handling.',
        contact: {
          name: 'AI Agents Server',
          url: 'https://github.com/AndlerRL/ai-agents-server'
        }
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Development server'
        }
      ],
      tags: [
        { 
          name: 'Introduction', 
          description: 'Server information and health endpoints' 
        },
        { 
          name: 'OpenAI Agents', 
          description: 'OpenAI agent operations using OpenAI Agents JS - handles agent lifecycle, chat completions, and tool execution' 
        },
        { 
          name: 'Custom AI', 
          description: 'Custom AI operations using Vercel AI SDK - provides streaming chat, embeddings, and custom AI workflows' 
        },
        { 
          name: 'WebSockets', 
          description: 'Real-time communication and event streaming via WebSocket connections' 
        }
      ],
      components: {
        schemas: {
          Agent: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, description: 'Unique agent identifier' },
              name: { type: 'string' as const, description: 'Agent display name' },
              model: { 
                type: 'object' as const,
                properties: {
                  provider: { type: 'string' as const, enum: ['openai'] },
                  model: { type: 'string' as const, example: 'gpt-4o-mini' },
                  config: { type: 'object' as const }
                }
              },
              status: { type: 'string' as const, enum: ['idle', 'busy', 'error'] },
              createdAt: { type: 'string' as const, format: 'date-time' }
            }
          },
          ChatMessage: {
            type: 'object' as const,
            properties: {
              role: { type: 'string' as const, enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' as const, description: 'Message content' }
            },
            required: ['role', 'content']
          },
          ChatRequest: {
            type: 'object' as const,
            properties: {
              model: { type: 'string' as const, default: 'gpt-4o-mini' },
              messages: {
                type: 'array' as const,
                items: { $ref: '#/components/schemas/ChatMessage' }
              },
              temperature: { type: 'number' as const, minimum: 0, maximum: 2 },
              maxTokens: { type: 'integer' as const, minimum: 1 }
            },
            required: ['messages']
          },
          ApiResponse: {
            type: 'object' as const,
            properties: {
              success: { type: 'boolean' as const },
              data: { type: 'object' as const },
              error: { type: 'string' as const },
              message: { type: 'string' as const }
            }
          }
        }
      }
    }
  }
}
