import { Elysia, t } from "elysia";

export const aiRoutes = new Elysia({ prefix: "/v1/ai" })
	.get(
		"/",
		() => ({
			title: "Custom AI Agent API",
			description:
				"Custom AI agent integration with Vercel AI SDK and streaming capabilities",
			version: "1.0.0",
			endpoints: {
				chat: "/v1/ai/chat/stream",
			},
		}),
		{
			detail: {
				tags: ["Custom AI"],
				summary: "AI API Info",
				description:
					"Get custom AI agent integration information using Vercel AI SDK",
			},
		},
	)

	.group("/chat", (app) =>
		app.post(
			"/stream",
			async (context: any) => {
				const { body, chatWithAgent } = context;
				try {
					const { model = "gpt-4o-mini", messages, stream = true } = body;

					if (stream) {
						const response = await chatWithAgent(model, messages, {
							stream: true,
						});
						return new Response(response.stream, {
							headers: {
								"Content-Type": "text/plain; charset=utf-8",
								"Cache-Control": "no-cache",
								Connection: "keep-alive",
							},
						});
					} else {
						const response = await chatWithAgent(model, messages, {
							stream: false,
						});
						return {
							success: true,
							data: response,
						};
					}
				} catch (error) {
					return {
						success: false,
						error: "AI chat failed",
						message: String(error),
					};
				}
			},
			{
				detail: {
					tags: ["Custom AI"],
					summary: "Streaming AI chat",
					description:
						"Generate streaming chat responses using Vercel AI SDK with real-time token streaming",
				},
				body: t.Object({
					model: t.String({ default: "gpt-4o-mini" }),
					messages: t.Array(t.Any()),
					stream: t.Boolean({ default: true, description: "Enable streaming response" }),
					temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
					maxTokens: t.Optional(t.Integer({ minimum: 1 })),
				}),
			}
		)
	);
