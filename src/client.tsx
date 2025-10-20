import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Dashboard, type DashboardData } from './components/dashboard'

// @ts-ignore
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
	throw new Error('Root element not found')
}

// Get dashboard data from window object (injected by server)
const dashboardData: DashboardData = (window as any).__DASHBOARD_DATA__ || {
	title: 'AI Agents Server',
	version: '1.0.0',
	uptime: 0,
	health: { status: 'unknown', openaiEnabled: false, mcpEnabled: false },
	statistics: {
		totalRequests: 0,
		totalAgents: 0,
		totalTokensUsed: 0,
		averageResponseTime: 0,
		errorRate: 0,
		activeConnections: 0,
		webhookSubscriptions: 0
	},
	features: {
		openai: { enabled: false, agents: 0, models: [] },
		vercel: { enabled: false, agents: 0, status: 'Coming Soon' },
		mcp: { enabled: false, servers: 0, activeServers: 0, totalTools: 0 },
		webhooks: { enabled: false, subscriptions: 0, activeConnections: 0 }
	}
}

hydrateRoot(
	rootElement,
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Dashboard data={dashboardData} />} />
				<Route path="/dashboard" element={<Dashboard data={dashboardData} />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
)
