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
          name: 'RAG System',
          description: 'Retrieval-Augmented Generation with multiple strategies and pgvector database'
        },
        {
          name: 'MCP',
          description: 'Model Context Protocol (MCP) server management and integration with AI agents'
        },
        { 
          name: 'Webhooks', 
          description: 'WebSocket event streaming and webhook management for real-time monitoring' 
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
          },
          MCPServerConfig: {
            type: 'object' as const,
            properties: {
              id: { type: 'string' as const, description: 'Unique server identifier' },
              name: { type: 'string' as const, description: 'Server display name' },
              description: { type: 'string' as const, description: 'Server description' },
              command: { type: 'string' as const, description: 'Command to execute', example: 'npx' },
              args: { 
                type: 'array' as const, 
                items: { type: 'string' as const },
                description: 'Command arguments',
                example: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']
              },
              env: { 
                type: 'object' as const, 
                description: 'Environment variables',
                additionalProperties: { type: 'string' as const }
              },
              transport: { 
                type: 'string' as const, 
                enum: ['stdio', 'sse', 'websocket'],
                default: 'stdio'
              },
              autoRestart: { type: 'boolean' as const, default: true },
              maxRestarts: { type: 'number' as const, default: 3 }
            },
            required: ['id', 'name', 'description', 'command', 'args']
          },
          MCPAgentConfig: {
            type: 'object' as const,
            properties: {
              agent: {
                type: 'object' as const,
                properties: {
                  name: { type: 'string' as const, description: 'Agent name' },
                  model: {
                    type: 'object' as const,
                    properties: {
                      provider: { type: 'string' as const, enum: ['openai', 'anthropic', 'custom'] },
                      model: { type: 'string' as const, example: 'gpt-4o-mini' },
                      config: { type: 'object' as const }
                    }
                  },
                  tools: { type: 'array' as const, items: { type: 'object' as const } },
                  memory: { type: 'object' as const },
                  status: { type: 'string' as const, enum: ['idle', 'processing', 'error'] }
                },
                required: ['name', 'model', 'tools', 'memory', 'status']
              },
              mcpServers: {
                type: 'array' as const,
                items: { type: 'string' as const },
                description: 'Array of MCP server IDs to attach',
                example: ['filesystem', 'github']
              },
              sdkType: {
                type: 'string' as const,
                enum: ['openai', 'vercel'],
                description: 'SDK type for agent'
              },
              autoImportTools: {
                type: 'boolean' as const,
                default: true,
                description: 'Auto-import MCP tools as agent tools'
              },
              toolPrefix: {
                type: 'string' as const,
                description: 'Prefix for imported tool names',
                example: 'mcp_'
              }
            },
            required: ['agent', 'mcpServers', 'sdkType']
          },
          RAGQuery: {
            type: 'object' as const,
            properties: {
              query: { 
                type: 'string' as const, 
                description: 'Search query text',
                example: 'What are the best practices for React hooks?'
              },
              strategy: {
                type: 'string' as const,
                enum: ['retrieve_read', 'hybrid', 'two_stage_rerank', 'fusion_in_decoder', 'augmented_reranking', 'federated', 'graph_rag', 'adaptive'],
                description: 'Retrieval strategy'
              },
              topK: {
                type: 'integer' as const,
                minimum: 1,
                maximum: 50,
                default: 5,
                description: 'Number of results to return'
              },
              granularity: {
                type: 'string' as const,
                enum: ['coarse', 'fine', 'adaptive'],
                default: 'coarse'
              },
              includeMetadata: {
                type: 'boolean' as const,
                default: false
              }
            },
            required: ['query']
          }
        }
      },
      examples: {
        CreateAgent: {
          summary: 'Create OpenAI Agent',
          description: 'Creates a new agent with GPT-4o-mini model',
          value: {
            name: 'My Assistant',
            model: 'gpt-4o-mini',
            tools: ['analyze_text'],
            config: {
              temperature: 0.7,
              maxTokens: 2000
            }
          }
        },
        ChatRequest: {
          summary: 'Simple Chat Request',
          description: 'Send a chat message to the agent',
          value: {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: 'Explain how AI agents work in simple terms'
              }
            ],
            temperature: 0.7,
            maxTokens: 500
          }
        },
        ChatRequestWithContext: {
          summary: 'Chat with Context',
          description: 'Multi-turn conversation with context',
          value: {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful AI assistant specialized in software development'
              },
              {
                role: 'user',
                content: 'What is the difference between promises and async/await?'
              }
            ],
            temperature: 0.5
          }
        },
        MCPServerFilesystem: {
          summary: 'File System MCP Server',
          description: 'Start a file system MCP server for local file operations',
          value: {
            id: 'filesystem',
            name: 'File System Server',
            description: 'Access and manage local file system',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
            transport: 'stdio',
            autoRestart: true,
            maxRestarts: 3
          }
        },
        MCPServerGitHub: {
          summary: 'GitHub MCP Server',
          description: 'Start a GitHub MCP server with authentication',
          value: {
            id: 'github',
            name: 'GitHub Server',
            description: 'Interact with GitHub repositories',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {
              GITHUB_TOKEN: 'ghp_your_token_here'
            },
            transport: 'stdio',
            autoRestart: true
          }
        },
        MCPServerCustom: {
          summary: 'Custom MCP Server',
          description: 'Start a custom MCP server implementation',
          value: {
            id: 'custom-api',
            name: 'Custom API Server',
            description: 'Custom tools for weather and email',
            command: 'bun',
            args: ['run', './my-mcp-server.ts'],
            transport: 'stdio',
            autoRestart: true,
            timeout: 30000
          }
        },
        MCPAgentOpenAI: {
          summary: 'OpenAI Agent with MCP',
          description: 'Create an OpenAI agent with file system access via MCP',
          value: {
            agent: {
              name: 'File Assistant',
              model: {
                provider: 'openai',
                model: 'gpt-4o-mini',
                config: {
                  temperature: 0.7,
                  maxTokens: 2000
                }
              },
              tools: [],
              memory: {},
              status: 'idle'
            },
            mcpServers: ['filesystem'],
            sdkType: 'openai',
            autoImportTools: true,
            toolPrefix: 'fs_'
          }
        },
        MCPAgentMultiServer: {
          summary: 'Multi-Server Agent',
          description: 'Create an agent with multiple MCP servers (files, GitHub, search)',
          value: {
            agent: {
              name: 'Super Assistant',
              model: {
                provider: 'openai',
                model: 'gpt-4o',
                config: {
                  temperature: 0.8
                }
              },
              tools: [],
              memory: {},
              status: 'idle'
            },
            mcpServers: ['filesystem', 'github', 'brave-search'],
            sdkType: 'openai',
            autoImportTools: true
          }
        },
        MCPToolExecution: {
          summary: 'Execute MCP Tool',
          description: 'Execute a file read operation using MCP server',
          value: {
            tool: 'read_file',
            parameters: {
              path: 'package.json'
            },
            serverId: 'filesystem',
            agentId: 'agent-123'
          }
        },
        RAGRetrieveBasic: {
          summary: 'Basic RAG Retrieval',
          description: 'Simple document retrieval query',
          value: {
            query: 'What are the best practices for React hooks?',
            topK: 5,
            granularity: 'coarse'
          }
        },
        RAGRetrieveAdvanced: {
          summary: 'Advanced RAG with Strategy',
          description: 'Retrieval with specific strategy and filters',
          value: {
            query: 'Explain microservices architecture patterns',
            strategy: 'hybrid',
            topK: 10,
            granularity: 'fine',
            includeMetadata: true,
            filters: {
              dateRange: {
                start: '2024-01-01T00:00:00Z',
                end: '2025-12-31T23:59:59Z'
              },
              sources: ['documentation', 'articles'],
              contentTypes: ['technical'],
              languages: ['en']
            }
          }
        },
        RAGDocument: {
          summary: 'Add Document to RAG',
          description: 'Add a new document to the RAG system',
          value: {
            content: 'This is a comprehensive guide about microservices architecture...',
            metadata: {
              title: 'Microservices Architecture Guide',
              source: 'technical-blog',
              author: 'John Doe',
              date: '2025-01-15',
              tags: ['microservices', 'architecture', 'patterns']
            }
          }
        }
      }
    }
  }
}
