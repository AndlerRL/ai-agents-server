import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Dashboard, type DashboardData } from './components/dashboard'

// @ts-ignore
import './index.css'
import { CanvasPage } from '~/routes/pages/canvas'
import { AgentsPage } from '~/routes/pages/agents'
import { ToolsPage } from '~/routes/pages/tools'
import { ChatPage } from '~/routes/pages/chat'
import { AdaptiveView, DocumentsView, NodesLayout, RetrievalView } from '~/routes/pages/nodes'
import { Layout } from '~/components/layout'

const rootElement = document.getElementById('root')
if (!rootElement) {
	throw new Error('Root element not found')
}

// Get data from window object (injected by server) TODO: remove...
const data: DashboardData = (window as any).__AC_DATA__

hydrateRoot(
	rootElement,
	(
		<Layout>
				<React.StrictMode>
					<BrowserRouter>
						<Routes>
							<Route path="/" element={<Dashboard data={data} />} />
							<Route path="/canvas" element={<CanvasPage />} />
							<Route path="/agents" element={<AgentsPage />} />
							<Route path="/tools" element={<ToolsPage />} />
							<Route path="/chat" element={<ChatPage />} />
							<Route path="/nodes" element={<NodesLayout activeTab="retrieval"><RetrievalView /></NodesLayout>} />
							<Route path="/nodes/adaptive" element={<NodesLayout activeTab="adaptive"><AdaptiveView /></NodesLayout>} />
							<Route path="/nodes/documents" element={<NodesLayout activeTab="documents"><DocumentsView /></NodesLayout>} />
						</Routes>
					</BrowserRouter>
				</React.StrictMode>
		</Layout>
	)
)
