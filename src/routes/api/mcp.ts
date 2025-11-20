/**
 * Model Context Protocol (MCP) Routes
 * Provides MCP server management and integration with AI agents
 * Supports WebSocket events for real-time MCP server monitoring
 */

import { Elysia, t } from 'elysia';
import { nanoid } from 'nanoid';
import type { MCPManager } from '../../core/mcp';
import type {
  MCPAgentConfig,
  MCPPromptCall,
  MCPResourceRequest,
  MCPServerConfig,
  MCPToolCall,
} from '../../core/mcp-types';
import type { ServerStateManager } from '../../core/state';
import type { WebhookManager } from '../../core/webhooks';

export const mcpRoutes = new Elysia({ prefix: '/v1/mcp' })

  // ============================================================================
  // MCP Server Management
  // ============================================================================

  .post(
    '/servers',
    async (context) => {
      try {
        const { body, set } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;
        const webhooks = (context as any).webhooks as WebhookManager;

        const config = body as MCPServerConfig;

        // Start the MCP server
        const server = await mcpManager.startServer(config);

        // Broadcast server started event
        await webhooks.broadcast({
          type: 'agent.created', // Using agent.created as closest match
          payload: {
            type: 'mcp.server.started',
            serverId: server.id,
            serverName: server.config.name,
            capabilities: {
              tools: server.tools.length,
              prompts: server.prompts.length,
              resources: server.resources.length,
            },
          },
          source: 'mcp',
        });

        set.status = 201;
        return {
          success: true,
          data: server,
        };
      } catch (error) {
        (context as any).set.status = 500;
        return {
          success: false,
          error: `Failed to start MCP server: ${error}`,
        };
      }
    },
    {
      body: t.Object({
        id: t.String(),
        name: t.String(),
        description: t.String(),
        command: t.String(),
        args: t.Array(t.String()),
        env: t.Optional(t.Record(t.String(), t.String())),
        transport: t.Optional(
          t.Union([
            t.Literal('stdio'),
            t.Literal('sse'),
            t.Literal('websocket'),
          ])
        ),
        timeout: t.Optional(t.Number()),
        autoRestart: t.Optional(t.Boolean()),
        maxRestarts: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Start MCP server',
        description:
          'Start a new Model Context Protocol server with specified configuration. Use official MCP servers (filesystem, GitHub, Brave Search) or create custom servers.',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MCPServerConfig' },
              examples: {
                filesystem: {
                  $ref: '#/components/examples/MCPServerFilesystem',
                },
                github: { $ref: '#/components/examples/MCPServerGitHub' },
                custom: { $ref: '#/components/examples/MCPServerCustom' },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/servers',
    (context) => {
      try {
        const mcpManager = (context as any).mcpManager as MCPManager;
        const servers = mcpManager.getAllServers();

        return {
          success: true,
          data: servers,
          meta: {
            total: servers.length,
            ready: servers.filter((s) => s.status === 'ready').length,
            error: servers.filter((s) => s.status === 'error').length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get MCP servers: ${error}`,
        };
      }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'List MCP servers',
        description:
          'Get all registered MCP servers and their status. Returns server details including available tools, prompts, and resources.',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                example: {
                  success: true,
                  data: [
                    {
                      id: 'filesystem',
                      status: 'ready',
                      tools: ['read_file', 'write_file', 'list_directory'],
                      prompts: [],
                      resources: [],
                    },
                  ],
                  meta: {
                    total: 3,
                    ready: 2,
                    error: 1,
                  },
                },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/servers/:id',
    (context) => {
      try {
        const { params, set } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;

        const server = mcpManager.getServer(params.id);

        if (!server) {
          set.status = 404;
          return {
            success: false,
            error: 'MCP server not found',
          };
        }

        return {
          success: true,
          data: server,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get MCP server: ${error}`,
        };
      }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'Get MCP server',
        description: 'Get a specific MCP server by ID',
      },
    }
  )

  .post(
    '/servers/:id/restart',
    async (context) => {
      try {
        const { params, set } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;
        const webhooks = (context as any).webhooks as WebhookManager;

        const server = await mcpManager.restartServer(params.id);

        // Broadcast restart event
        await webhooks.broadcast({
          type: 'agent.processing',
          payload: {
            type: 'mcp.server.restarted',
            serverId: server.id,
            serverName: server.config.name,
          },
          source: 'mcp',
        });

        return {
          success: true,
          data: server,
          message: 'MCP server restarted successfully',
        };
      } catch (error) {
        (context as any).set.status = 500;
        return {
          success: false,
          error: `Failed to restart MCP server: ${error}`,
        };
      }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'Restart MCP server',
        description: 'Restart a specific MCP server',
      },
    }
  )

  .delete(
    '/servers/:id',
    async (context) => {
      try {
        const { params, set } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;
        const webhooks = (context as any).webhooks as WebhookManager;

        const stopped = await mcpManager.stopServer(params.id);

        if (!stopped) {
          set.status = 404;
          return {
            success: false,
            error: 'MCP server not found',
          };
        }

        // Broadcast stop event
        await webhooks.broadcast({
          type: 'agent.completed',
          payload: {
            type: 'mcp.server.stopped',
            serverId: params.id,
          },
          source: 'mcp',
        });

        return {
          success: true,
          message: 'MCP server stopped successfully',
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to stop MCP server: ${error}`,
        };
      }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'Stop MCP server',
        description: 'Stop and remove a specific MCP server',
      },
    }
  )

  // ============================================================================
  // Tool Management & Execution
  // ============================================================================

  .get(
    '/tools',
    (context) => {
      try {
        const { query } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;

        const serverId = query.serverId as string | undefined;

        const tools = serverId
          ? mcpManager.getServerTools(serverId)
          : mcpManager.getAllTools();

        return {
          success: true,
          data: tools,
          meta: {
            total: tools.length,
            serverId: serverId || 'all',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get MCP tools: ${error}`,
        };
      }
    },
    {
      query: t.Object({
        serverId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'List MCP tools',
        description: 'Get available tools from MCP servers',
      },
    }
  )

  .post(
    '/tools/execute',
    async (context) => {
      try {
        const { body } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;
        const webhooks = (context as any).webhooks as WebhookManager;

        const { tool, parameters, serverId, agentId } = body as {
          tool: string;
          parameters: Record<string, unknown>;
          serverId: string;
          agentId?: string;
        };

        const toolCall: MCPToolCall = {
          tool,
          parameters,
          serverId,
          agentId: agentId || 'system',
          callId: nanoid(),
        };

        const response = await mcpManager.executeTool(toolCall);

        // Broadcast tool execution event
        await webhooks.broadcast({
          type: 'tool.executed',
          payload: {
            type: 'mcp.tool.executed',
            toolName: tool,
            serverId,
            agentId,
            executionTime: response.executionTime,
            success: response.result.success,
          },
          source: 'mcp',
        });

        return {
          success: true,
          data: response,
        };
      } catch (error) {
        (context as any).set.status = 500;
        return {
          success: false,
          error: `Failed to execute MCP tool: ${error}`,
        };
      }
    },
    {
      body: t.Object({
        tool: t.String(),
        parameters: t.Record(t.String(), t.Any()),
        serverId: t.String(),
        agentId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Execute MCP tool',
        description:
          'Execute a tool from an MCP server. Tools are functions provided by MCP servers (e.g., file operations, API calls, database queries).',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tool: { type: 'string', description: 'Tool name' },
                  parameters: {
                    type: 'object',
                    description: 'Tool parameters',
                  },
                  serverId: { type: 'string', description: 'MCP server ID' },
                  agentId: {
                    type: 'string',
                    description: 'Agent ID (optional)',
                  },
                },
              },
              examples: {
                readFile: { $ref: '#/components/examples/MCPToolExecution' },
                listDirectory: {
                  summary: 'List Directory',
                  value: {
                    tool: 'list_directory',
                    parameters: { path: '/workspace' },
                    serverId: 'filesystem',
                    agentId: 'agent-123',
                  },
                },
                createIssue: {
                  summary: 'Create GitHub Issue',
                  value: {
                    tool: 'create_issue',
                    parameters: {
                      repo: 'owner/repo',
                      title: 'Bug: Application crashes on startup',
                      body: 'Detailed description of the issue...',
                    },
                    serverId: 'github',
                    agentId: 'agent-456',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Tool executed successfully',
            content: {
              'application/json': {
                example: {
                  success: true,
                  data: {
                    callId: 'call-123',
                    result: {
                      success: true,
                      data: 'File content here...',
                    },
                    executionTime: 234,
                    serverId: 'filesystem',
                    timestamp: '2025-10-19T12:00:00Z',
                  },
                },
              },
            },
          },
        },
      },
    }
  )

  // ============================================================================
  // Prompt Management
  // ============================================================================

  .get(
    '/prompts',
    (context) => {
      try {
        const { query } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;

        const serverId = query.serverId as string | undefined;

        const prompts = serverId
          ? mcpManager.getServerPrompts(serverId)
          : mcpManager.getAllPrompts();

        return {
          success: true,
          data: prompts,
          meta: {
            total: prompts.length,
            serverId: serverId || 'all',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get MCP prompts: ${error}`,
        };
      }
    },
    {
      query: t.Object({
        serverId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'List MCP prompts',
        description: 'Get available prompts from MCP servers',
      },
    }
  )

  .post(
    '/prompts/execute',
    async (context) => {
      try {
        const { body } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;

        const promptCall = body as MCPPromptCall;
        const response = await mcpManager.executePrompt(promptCall);

        return {
          success: true,
          data: response,
        };
      } catch (error) {
        (context as any).set.status = 500;
        return {
          success: false,
          error: `Failed to execute MCP prompt: ${error}`,
        };
      }
    },
    {
      body: t.Object({
        prompt: t.String(),
        arguments: t.Record(t.String(), t.Any()),
        serverId: t.String(),
        agentId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Execute MCP prompt',
        description: 'Execute a prompt from an MCP server',
      },
    }
  )

  // ============================================================================
  // Resource Management
  // ============================================================================

  .get(
    '/resources',
    (context) => {
      try {
        const { query } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;

        const serverId = query.serverId as string | undefined;

        const resources = serverId
          ? mcpManager.getServerResources(serverId)
          : mcpManager.getAllResources();

        return {
          success: true,
          data: resources,
          meta: {
            total: resources.length,
            serverId: serverId || 'all',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get MCP resources: ${error}`,
        };
      }
    },
    {
      query: t.Object({
        serverId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'List MCP resources',
        description: 'Get available resources from MCP servers',
      },
    }
  )

  .post(
    '/resources/access',
    async (context) => {
      try {
        const { body } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;

        const request = body as MCPResourceRequest;
        const response = await mcpManager.accessResource(request);

        return {
          success: true,
          data: response,
        };
      } catch (error) {
        (context as any).set.status = 500;
        return {
          success: false,
          error: `Failed to access MCP resource: ${error}`,
        };
      }
    },
    {
      body: t.Object({
        uri: t.String(),
        serverId: t.String(),
        agentId: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Access MCP resource',
        description: 'Access a resource from an MCP server',
      },
    }
  )

  // ============================================================================
  // Agent-MCP Integration
  // ============================================================================

  .post(
    '/agents',
    async (context) => {
      try {
        const { body, set } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;
        const state = (context as any).state as ServerStateManager;
        const webhooks = (context as any).webhooks as WebhookManager;

        const config = body as MCPAgentConfig;

        // Create agent with MCP integration
        const agent = await mcpManager.createMCPAgent(config);

        // Register agent with state manager
        state.createAgent(agent);

        // Broadcast agent creation event
        await webhooks.broadcast({
          type: 'agent.created',
          payload: {
            type: 'mcp.agent.created',
            agentId: agent.id,
            agentName: agent.name,
            mcpServers: config.mcpServers,
            sdkType: config.sdkType,
            toolsImported: config.autoImportTools,
          },
          source: 'mcp',
        });

        set.status = 201;
        return {
          success: true,
          data: agent,
        };
      } catch (error) {
        (context as any).set.status = 500;
        return {
          success: false,
          error: `Failed to create MCP agent: ${error}`,
        };
      }
    },
    {
      body: t.Object({
        agent: t.Object({
          name: t.String(),
          model: t.Object({
            provider: t.Union([
              t.Literal('openai'),
              t.Literal('anthropic'),
              t.Literal('custom'),
            ]),
            model: t.String(),
            config: t.Object({}),
          }),
          tools: t.Array(t.Any()),
          memory: t.Any(),
          status: t.Union([
            t.Literal('idle'),
            t.Literal('processing'),
            t.Literal('error'),
          ]),
        }),
        mcpServers: t.Array(t.String()),
        sdkType: t.Union([t.Literal('openai'), t.Literal('vercel')]),
        autoImportTools: t.Optional(t.Boolean()),
        toolPrefix: t.Optional(t.String()),
      }),
      detail: {
        tags: ['MCP'],
        summary: 'Create MCP-enabled agent',
        description:
          'Create an AI agent with MCP server integration. The agent will have access to all tools from the specified MCP servers. Works with both OpenAI and Vercel AI SDK.',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MCPAgentConfig' },
              examples: {
                openai: { $ref: '#/components/examples/MCPAgentOpenAI' },
                multiServer: {
                  $ref: '#/components/examples/MCPAgentMultiServer',
                },
                vercel: {
                  summary: 'Vercel AI SDK Agent',
                  value: {
                    agent: {
                      name: 'Vercel Assistant',
                      model: {
                        provider: 'openai',
                        model: 'gpt-4o-mini',
                        config: { temperature: 0.7 },
                      },
                      tools: [],
                      memory: {},
                      status: 'idle',
                    },
                    mcpServers: ['filesystem'],
                    sdkType: 'vercel',
                    autoImportTools: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Agent created successfully',
            content: {
              'application/json': {
                example: {
                  success: true,
                  data: {
                    id: 'agent-789',
                    name: 'File Assistant',
                    model: { provider: 'openai', model: 'gpt-4o-mini' },
                    tools: [
                      'fs_read_file',
                      'fs_write_file',
                      'fs_list_directory',
                    ],
                    status: 'idle',
                    createdAt: '2025-10-19T12:00:00Z',
                  },
                },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/agents/:id/servers',
    (context) => {
      try {
        const { params } = context;
        const mcpManager = (context as any).mcpManager as MCPManager;

        const serverIds = mcpManager.getAgentMCPServers(params.id);
        const servers = serverIds
          .map((id) => mcpManager.getServer(id))
          .filter(Boolean);

        return {
          success: true,
          data: servers,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get agent MCP servers: ${error}`,
        };
      }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'Get agent MCP servers',
        description: 'Get MCP servers associated with an agent',
      },
    }
  )

  // ============================================================================
  // Statistics & Documentation
  // ============================================================================

  .get(
    '/mcp/stats',
    (context) => {
      try {
        const mcpManager = (context as any).mcpManager as MCPManager;
        const stats = mcpManager.getStatistics();

        return {
          success: true,
          data: stats,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get MCP statistics: ${error}`,
        };
      }
    },
    {
      detail: {
        tags: ['MCP'],
        summary: 'MCP statistics',
        description: 'Get Model Context Protocol system statistics',
      },
    }
  )

  .get(
    '/docs',
    () => ({
      title: 'Model Context Protocol (MCP) Documentation',
      overview:
        'The Model Context Protocol enables AI agents to connect to external tools, data sources, and services through standardized MCP servers.',

      concepts: {
        mcpServers:
          'Standalone processes that expose tools, prompts, and resources via the MCP protocol',
        tools:
          'Functions that agents can call to perform actions (e.g., file operations, API calls)',
        prompts: 'Pre-defined prompt templates that can be used with agents',
        resources:
          'Data sources that agents can access (e.g., files, databases, APIs)',
      },

      usage: {
        startServer: {
          endpoint: 'POST /mcp/servers',
          description: 'Start a new MCP server with command and arguments',
          example: {
            id: 'my-server',
            name: 'My MCP Server',
            description: 'A custom MCP server',
            command: 'node',
            args: ['path/to/server.js'],
            transport: 'stdio',
          },
        },
        createAgent: {
          endpoint: 'POST /mcp/agents',
          description: 'Create an agent with MCP server integration',
          example: {
            agent: {
              name: 'My Agent',
              model: { provider: 'openai', model: 'gpt-4o-mini', config: {} },
              tools: [],
              memory: {},
              status: 'idle',
            },
            mcpServers: ['my-server'],
            sdkType: 'openai',
            autoImportTools: true,
          },
        },
        executeTool: {
          endpoint: 'POST /mcp/tools/execute',
          description: 'Execute a tool from an MCP server',
          example: {
            tool: 'read_file',
            parameters: { path: '/path/to/file.txt' },
            serverId: 'my-server',
            agentId: 'agent-123',
          },
        },
      },

      sdkSupport: {
        openai: 'OpenAI SDK agents can use MCP tools through function calling',
        vercel: 'Vercel AI SDK agents can integrate MCP tools as custom tools',
      },

      websocketEvents: {
        description:
          'MCP events are broadcasted via WebSocket for real-time monitoring',
        events: [
          'mcp.server.started',
          'mcp.server.stopped',
          'mcp.server.error',
          'mcp.tool.executed',
          'mcp.agent.created',
        ],
        endpoint: 'ws://localhost:3001/webhooks/ws',
      },

      examples: {
        fileSystemServer: {
          description: 'MCP server for file system operations',
          command: 'npx',
          args: [
            '-y',
            '@modelcontextprotocol/server-filesystem',
            '/path/to/directory',
          ],
        },
        githubServer: {
          description: 'MCP server for GitHub operations',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
        },
        customServer: {
          description: 'Custom MCP server implementation',
          command: 'bun',
          args: ['run', './my-mcp-server.ts'],
        },
      },
    }),
    {
      detail: {
        tags: ['MCP'],
        summary: 'MCP documentation',
        description:
          'Comprehensive documentation for Model Context Protocol integration',
      },
    }
  );
