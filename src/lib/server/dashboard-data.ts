import { DashboardData } from "~/components/dashboard"
import { renderDashboard } from "~/lib/render-dashboard"
import { config } from "~/lib/server/config"

export async function getDashboardDataHandler(context: any) {
  const serverState = context.serverState
  const webhooks = context.webhookManager
  const mcpManager = context.mcpManager
  
  if (!serverState) {
    console.error('❌ serverState is undefined in dashboard handler')
    return 'Error: Server state not available'
  }
  
  const stateSnapshot = serverState.getStateSnapshot()
  const webhookStats = webhooks?.getStatistics() || {
    totalSubscriptions: 0,
    activeConnections: 0
  }
  const mcpStats = mcpManager ? mcpManager.getStatistics() : null
  
  const agents = Array.from(stateSnapshot.agents.values())
  const openaiAgents = agents.filter(a => a.model.provider === 'openai')
  const customAgents = agents.filter(a => a.model.provider === 'custom')
  const mcpAgents = agents.filter(a => (a as any).mcpServers?.length > 0)
  
  const dashboardData: DashboardData = {
    title: 'AI Agents Server',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    health: {
      status: serverState.getHealthCheck().status,
      openaiEnabled: Boolean(config.openai.apiKey),
      mcpEnabled: Boolean(mcpManager)
    },
    statistics: {
      totalRequests: stateSnapshot.statistics.totalRequests,
      totalAgents: agents.length,
      totalTokensUsed: stateSnapshot.statistics.totalTokensUsed,
      averageResponseTime: stateSnapshot.statistics.averageResponseTime,
      errorRate: stateSnapshot.statistics.errorRate,
      activeConnections: stateSnapshot.activeConnections.size,
      webhookSubscriptions: webhookStats.totalSubscriptions
    },
    features: {
      openai: {
        enabled: openaiAgents.length > 0 || Boolean(config.openai.apiKey),
        agents: openaiAgents.length,
        models: [...new Set(openaiAgents.map(a => a.model.model))]
      },
      vercel: {
        enabled: customAgents.length > 0,
        agents: customAgents.length,
        status: 'Coming Soon'
      },
      mcp: {
        enabled: Boolean(mcpManager),
        agents: mcpAgents.length,
        servers: mcpStats?.totalServers || 0,
        activeServers: mcpStats?.activeServers || 0,
        totalTools: mcpStats?.totalTools || 0
      },
      webhooks: {
        enabled: true,
        subscriptions: webhookStats.totalSubscriptions,
        activeConnections: webhookStats.activeConnections
      }
    }
  }

  const html = renderDashboard(dashboardData)
  console.log('📱 Dashboard HTML length:', html.length, 'chars')
  console.log('📱 First 200 chars:', html.substring(0, 200))

  // Set the content type header before returning
  context.set.headers['Content-Type'] = 'text/html; charset=utf-8'
  
  // Return HTML directly
  return html
}

export const dashboardRouteOptions = {
  detail: {
    tags: ['Dashboard'],
    summary: 'Interactive React dashboard UI',
    description: 'Server-side rendered React dashboard with real-time statistics and feature overview'
  }
}