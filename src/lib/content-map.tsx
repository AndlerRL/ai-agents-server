import type { ReactNode } from 'react'

// Centralized content map for both client and server
export const contentMap: Record<string, ReactNode> = {
	'/': `🤖 Welcome to the AI Agents Server

A sophisticated agentic AI platform with:
• Multi-model LLM support (OpenAI, extensible)
• Real-time WebSocket event streaming
• Intelligent memory management with chunking
• Tool registry and execution framework
• Dependency injection architecture

Pick your API interface:
1. 🧠 OpenAI Agents API (/v1/openai/)
2. ⚡ Vercel AI SDK API (/v1/vercel/)
3. 🔗 WebSocket Events (/webhooks/)
4. 📊 Management Dashboard (/dashboard/)

Quick Start:
- API Documentation: /swagger
- Health Check: /health
- WebSocket: ws://localhost:3000/ws`,

	'/v1/openai/': `🧠 OpenAI Agents API Dashboard

Advanced AI agent management with GPT-4 and GPT-3.5 Turbo integration.

Features:
• Agent lifecycle management
• Chat completions with context
• Tool integration and execution
• Memory persistence and search
• Real-time event streaming

Available Endpoints:
• POST /agents - Create new agent
• GET /agents - List all agents
• POST /chat/completions - Send messages
• GET /tools - List available tools
• GET /models - List OpenAI models

Event Types:
• agent.created, agent.processing
• agent.completed, agent.error
• tool.executed, memory.updated`,

	'/v1/vercel/': `⚡ Vercel AI SDK API Dashboard

Next-generation AI SDK integration with streaming capabilities.

🚧 Coming Soon - Expansion Points:
• Streaming text generation
• Multi-provider model support
• Function calling with tools
• Real-time response streaming
• Embedding generation

Planned Integration:
• @ai-sdk/openai
• @ai-sdk/anthropic  
• @ai-sdk/google
• Custom provider support

This is designed as an extension point for future
Vercel AI SDK integration with minimal refactoring.`,

	'/webhooks/': `🔗 Webhook & Event Streaming

Real-time event broadcasting via WebSocket connections.

Features:
• WebSocket connection management
• Event filtering and subscriptions
• Message persistence and buffering
• Heartbeat and health monitoring
• Custom event broadcasting

Event Types:
• agent.* - Agent lifecycle events
• tool.executed - Tool execution results
• memory.updated - Memory store changes
• conversation.* - Chat session events

WebSocket URL: ws://localhost:3000/ws
Connection limit: 1000 concurrent
Buffer size: 100 events`,

	'/dashboard/': `📊 Management Dashboard

Comprehensive server monitoring and administration.

Statistics:
• Server health and performance
• Agent status and metrics
• Memory usage and optimization
• WebSocket connection tracking
• API call analytics

Management:
• Agent overview and control
• Tool registry inspection
• Memory store statistics
• System logs and debugging
• Cleanup and maintenance

Actions:
• Inactive agent cleanup
• Memory optimization
• Connection management
• System restart (placeholder)`
}

// Helper function to get content with a fallback
export function getContent(
	path: string,
	fallback: ReactNode = 'Welcome to the AI Agents Server - A sophisticated agentic AI platform.',
): ReactNode {
	return contentMap[path] || fallback
}
