import { Elysia } from "elysia";
import { getDatabaseConnection } from "../../database/connection";
import * as schema from "../../database/schema";

export const canvasRoutes = new Elysia({ prefix: "/v1/canvas" })
	.get("/", () => ({
		title: "AgentCanvas Flow API",
		description: "Manage agentic flows, agents, tools, and mediators",
		endpoints: {
			flows: "/v1/canvas/flows",
			agents: "/v1/canvas/agents",
			tools: "/v1/canvas/tools",
			mediators: "/v1/canvas/mediators",
		}
	}), {
		detail: {
			tags: ["AgentCanvas"],
			summary: "AgentCanvas API",
			description: "AgentCanvas API for managing agentic flows"
		}
	})
	
	// Flows Management
	.group("/flows", (app) => app
		.get("/", () => ({ success: true, data: [] }), {
			detail: { tags: ["AgentCanvas"], summary: "List flows" }
		})
		.post("/", async ({ body }: { body: Record<string, unknown> }) => {
			const { db } = getDatabaseConnection();
			if (!db) throw new Error("Database not initialized");
			
			const { name, description, sdk, mediator, agents, tools, trigger } = body as { name: string; description?: string; sdk?: string; mediator?: unknown; agents?: unknown[]; tools?: unknown[]; trigger?: unknown };
			
			const [flow] = await db.insert(schema.flows).values({
				name,
				description,
				sdk: (sdk || 'openai') as "openai" | "vercel_ai",
				isActive: 1,
				configuration: { mediator, agents, tools, trigger }
			}).returning();
			
			return { success: true, data: flow };
		}, {
			detail: { 
				tags: ["AgentCanvas"], 
				summary: "Create flow",
				description: "Create a new agentic flow: Name > SDK > Mediator > Agents > Tools > Trigger/Output"
			}
		})
	)
	
	// Agents Management
	.group("/agents", (app) => app
		.get("/", () => ({ success: true, data: [] }), {
			detail: { tags: ["AgentCanvas"], summary: "List agents" }
		})
		.post("/", async ({ body }: { body: Record<string, unknown> }) => {
			const { db } = getDatabaseConnection();
			if (!db) throw new Error("Database not initialized");
			
			const { name, description, role, goal, model, tools } = body as { name: string; description?: string; role: string; goal: string; model?: string; tools?: string[] };
			
			const [agent] = await db.insert(schema.agents).values({
				name,
				description,
				model: model || 'gpt-4o-mini',
				systemPrompt: `You are a ${role}. Your goal is: ${goal}.`,
				metadata: { role, goal, tools }
			}).returning();
			
			return { success: true, data: agent };
		}, {
			detail: { tags: ["AgentCanvas"], summary: "Create agent" }
		})
	)
	
	// Tools Management
	.group("/tools", (app) => app
		.get("/", () => ({ success: true, data: [] }), {
			detail: { tags: ["AgentCanvas"], summary: "List tools" }
		})
	);
