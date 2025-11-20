import { Elysia, t } from 'elysia';
import { nanoid } from 'nanoid';
import { Container } from '~/core/container';
import { LLMManager } from '~/core/llm';
import { ServerStateManager } from '~/core/state';
import { AgentInstance, ChatRequest } from '~/core/types';
import { WebhookManager } from '~/core/webhooks';

export const openaiRoutes = new Elysia({ prefix: '/v1/openai' })
  .get(
    '/',
    () => ({
      title: 'OpenAI Agents API',
      description:
        'OpenAI agent integration with chat completions and tool calling',
      version: '1.0.0',
      endpoints: {
        agents: '/v1/openai/agents',
        chat: '/v1/openai/chat',
        models: '/v1/openai/models',
        tools: '/v1/openai/tools',
      },
    }),
    {
      detail: {
        tags: ['OpenAI Agents'],
        summary: 'OpenAI API information',
        description:
          'Get OpenAI agent integration information and available endpoints',
      },
    }
  )

  // Agent management
  .group('/agents', (app) =>
    app
      .get(
        '/agents',
        (context) => {
          const state = (context as any).state as ServerStateManager;
          const agents = state?.getAllAgents();
          return {
            success: true,
            data: agents,
          };
        },
        {
          detail: {
            tags: ['OpenAI'],
            summary: 'List all agents',
            description: 'Retrieve all created agents',
          },
        }
      )

      .post('/', async (context) => {
        try {
          const { body, set } = context;
          const { name, model, tools = [], config = {} } = body as any;

          // Access services from global decorators
          const state = (context as any).state as ServerStateManager;
          const webhooks = (context as any).webhooks as WebhookManager;
          const container = (context as any).container as Container;

          const llmManager = (await container.resolve(
            'llmManager'
          )) as LLMManager;

          const agent: AgentInstance = {
            id: nanoid(),
            name,
            model: {
              provider: 'openai',
              model: model || 'gpt-4o-mini',
              config: {
                temperature: 0.7,
                maxTokens: 4096,
                ...config,
              },
            },
            tools: tools,
            memory: await container.resolve('memoryStore'),
            status: 'idle',
            createdAt: new Date(),
            lastActivity: new Date(),
          };

          state.createAgent(agent);

          // Broadcast agent creation event
          await webhooks.broadcast({
            type: 'agent.created',
            payload: { agentId: agent.id, name: agent.name },
            source: 'openai',
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
            error: `Failed to create agent: ${error}`,
          };
        }
      })

      .get(
        '/:id',
        (context) => {
          const { params, set } = context;
          const state = (context as any).state as ServerStateManager;
          const agent = state.getAgent(params.id);
          if (!agent) {
            set.status = 404;
            return {
              success: false,
              error: 'Agent not found',
            };
          }

          return {
            success: true,
            data: agent,
          };
        },
        {
          detail: {
            tags: ['OpenAI'],
            summary: 'Get agent by ID',
            description: 'Retrieve a specific agent by its ID',
          },
        }
      )

      .delete(
        '/:id',
        async (context) => {
          const { params, set } = context;
          const state = (context as any).state as ServerStateManager;
          const webhooks = (context as any).webhooks as WebhookManager;

          const deleted = state.deleteAgent(params.id);
          if (!deleted) {
            set.status = 404;
            return {
              success: false,
              error: 'Agent not found',
            };
          }

          // Broadcast agent deletion event
          await webhooks.broadcast({
            type: 'agent.error', // Using error as deletion event
            payload: { agentId: params.id, action: 'deleted' },
            source: 'openai',
          });

          return {
            success: true,
            message: 'Agent deleted successfully',
          };
        },
        {
          detail: {
            tags: ['OpenAI'],
            summary: 'Delete agent',
            description: 'Delete an agent by its ID',
          },
        }
      )
  )

  // Chat completions
  .group('/chat', (app) =>
    app
      .post(
        '/completions',
        async (context) => {
          try {
            const { body, set } = context;
            const request = body as ChatRequest;

            const state = (context as any).state as ServerStateManager;
            const webhooks = (context as any).webhooks as WebhookManager;
            const container = (context as any).container as Container;
            const llmManager = (await container.resolve(
              'llmManager'
            )) as LLMManager;

            // Get or create agent
            let agent = request.agentId
              ? state.getAgent(request.agentId)
              : null;
            if (!agent) {
              // Create temporary agent
              agent = {
                id: nanoid(),
                name: 'Temporary Agent',
                model: {
                  provider: 'openai',
                  model: request.model || 'gpt-4o-mini',
                  config: {
                    temperature: 0.7,
                    maxTokens: 4096,
                  },
                },
                tools: [],
                memory: await container.resolve('memoryStore'),
                status: 'processing',
                createdAt: new Date(),
                lastActivity: new Date(),
              };
              state.createAgent(agent);
            }

            // Update agent status
            state.updateAgent(agent.id, {
              status: 'processing',
              lastActivity: new Date(),
            });

            // Broadcast processing event
            await webhooks.broadcast({
              type: 'agent.processing',
              payload: {
                agentId: agent.id,
                message: request.message,
                model: agent.model.model,
              },
              source: 'openai',
            });

            // Create chat message
            const messages = [
              {
                id: nanoid(),
                role: 'user' as const,
                content: request.message,
                timestamp: new Date(),
              },
            ];

            // Get model ID for the agent's model
            const modelId =
              agent.model.model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini';

            // Call LLM
            const response = await llmManager.chat(modelId, messages, {
              tools: request.tools,
              config: agent.model.config,
            });

            // Update statistics
            state.incrementRequests();
            state.addTokenUsage(response.metadata.tokensUsed);
            state.updateResponseTime(response.metadata.processingTime);

            // Update agent status
            state.updateAgent(agent.id, {
              status: 'idle',
              lastActivity: new Date(),
            });

            // Broadcast completion event
            await webhooks.broadcast({
              type: 'agent.completed',
              payload: {
                agentId: agent.id,
                response: response.message,
                tokensUsed: response.metadata.tokensUsed,
                processingTime: response.metadata.processingTime,
              },
              source: 'openai',
            });

            return {
              success: true,
              data: {
                ...response,
                agentId: agent.id,
              },
            };
          } catch (error) {
            (context as any).set.status = 500;

            // Broadcast error event
            const webhooks = (context as any).webhooks as WebhookManager;
            await webhooks.broadcast({
              type: 'agent.error',
              payload: { error: String(error) },
              source: 'openai',
            });

            return {
              success: false,
              error: `Chat completion failed: ${error}`,
            };
          }
        },
        {
          body: t.Object({
            message: t.String(),
            agentId: t.Optional(t.String()),
            model: t.Optional(t.String()),
            tools: t.Optional(t.Array(t.String())),
            context: t.Optional(t.Object({})),
            stream: t.Optional(t.Boolean()),
          }),
          detail: {
            tags: ['OpenAI'],
            summary: 'Chat completion',
            description: 'Send a message to an AI agent and get a response',
          },
        }
      )

      // ============================================================================
      // Tool Management
      // ============================================================================
      .get(
        '/tools',
        async (context) => {
          const container = (context as any).container as Container;
          const toolRegistry = (await container.resolve('toolRegistry')) as any;
          const tools = toolRegistry.getAll();

          return {
            success: true,
            data: tools.map((tool: any) => ({
              name: tool.name,
              description: tool.description,
              category: tool.category,
              parameters: tool.parameters,
            })),
          };
        },
        {
          detail: {
            tags: ['OpenAI'],
            summary: 'List available tools',
            description: 'Get all available tools for agents',
          },
        }
      )

      .post(
        '/tools/:name/execute',
        async (context) => {
          try {
            const { params, body, set } = context;
            const container = (context as any).container as Container;
            const webhooks = (context as any).webhooks as WebhookManager;

            const toolRegistry = (await container.resolve(
              'toolRegistry'
            )) as any;
            const result = await toolRegistry.execute(
              params.name,
              body as Record<string, unknown>
            );

            // Broadcast tool execution event
            await webhooks.broadcast({
              type: 'tool.executed',
              payload: {
                toolName: params.name,
                parameters: body,
                result: result.success,
                data: result.data,
              },
              source: 'openai',
            });

            if (!result.success) {
              set.status = 400;
            }

            return {
              success: result.success,
              data: result.data,
              error: result.error,
            };
          } catch (error) {
            (context as any).set.status = 500;
            return {
              success: false,
              error: `Tool execution failed: ${error}`,
            };
          }
        },
        {
          detail: {
            tags: ['OpenAI'],
            summary: 'Execute a tool',
            description: 'Execute a specific tool with parameters',
          },
        }
      )

      // ============================================================================
      // Dashboard endpoint for OpenAI
      // ============================================================================
      .get(
        '/',
        () => {
          return {
            title: 'OpenAI Agents Dashboard',
            description: 'Manage OpenAI-powered AI agents',
            features: [
              'Agent Creation & Management',
              'Chat Completions with GPT-4 & GPT-3.5',
              'Tool Integration & Execution',
              'Real-time Event Streaming',
              'Memory & Context Management',
            ],
            endpoints: {
              agents: '/v1/openai/agents',
              chat: '/v1/openai/chat/completions',
              tools: '/v1/openai/tools',
              models: '/v1/openai/models',
            },
          };
        },
        {
          detail: {
            tags: ['OpenAI'],
            summary: 'OpenAI dashboard',
            description: 'Get OpenAI API dashboard information',
          },
        }
      )

      .get(
        '/models',
        async (context) => {
          try {
            const container = (context as any).container as Container;
            const llmManager = (await container.resolve(
              'llmManager'
            )) as LLMManager;
            const models = llmManager.getAllModels();

            return {
              success: true,
              data: models
                .filter((model: any) => model.provider === 'openai')
                .map((model: any) => ({
                  id: model.model,
                  provider: model.provider,
                  config: model.config,
                })),
            };
          } catch (error) {
            return {
              success: false,
              error: `Failed to get models: ${error}`,
            };
          }
        },
        {
          detail: {
            tags: ['OpenAI'],
            summary: 'List OpenAI models',
            description: 'Get all available OpenAI models',
          },
        }
      )
  );
