import * as React from 'react'
import { cn } from '../lib/cn'
import { Badge } from './base/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './base/card'
import { Separator } from './base/separator'

export interface DashboardData {
  title: string
  version: string
  uptime: number
  health: {
    status: string
    openaiEnabled: boolean
    mcpEnabled: boolean
  }
  statistics: {
    totalRequests: number
    totalAgents: number
    totalTokensUsed: number
    averageResponseTime: number
    errorRate: number
    activeConnections: number
    webhookSubscriptions: number
  }
  features: {
    openai: {
      enabled: boolean
      agents: number
      models: string[]
    }
    vercel: {
      enabled: boolean
      agents: number
      status: string
    }
    mcp: {
      enabled: boolean
      agents: number
      servers: number
      activeServers: number
      totalTools: number
    }
    webhooks: {
      enabled: boolean
      subscriptions: number
      activeConnections: number
    }
  }
}

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: string
}

function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-2xl">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

interface FeatureCardProps {
  name: string
  icon: string
  enabled: boolean
  status?: string
  stats: Array<{ label: string; value: string | number }>
}

function FeatureCard({ name, icon, enabled, status, stats }: FeatureCardProps) {
  return (
    <Card className={cn(
      'transition-all',
      enabled ? 'border-green-500/50 bg-green-50/5' : 'opacity-60'
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>{icon}</span>
            <span>{name}</span>
          </CardTitle>
          <Badge variant={enabled ? 'default' : 'secondary'}>
            {status || (enabled ? 'ENABLED' : 'DISABLED')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{stat.label}</span>
              <span className="font-semibold">{stat.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

interface QuickLinkProps {
  href: string
  title: string
  description: string
  icon: string
}

function QuickLink({ href, title, description, icon }: QuickLinkProps) {
  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 p-4 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-semibold">
            <span>{icon}</span>
            <span>{title}</span>
          </div>
          <p className="mt-1 text-sm opacity-90">{description}</p>
        </div>
      </div>
      <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/10" />
    </a>
  )
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [autoRefresh, setAutoRefresh] = React.useState(true)

  React.useEffect(() => {
    if (!autoRefresh) return
    
    const timer = setTimeout(() => {
      window.location.reload()
    }, 10000)
    
    return () => clearTimeout(timer)
  }, [autoRefresh])

  return (
    <div className="container mx-auto space-y-8">
      {/* Header */}
      <Card className="bg-white/50 backdrop-blur dark:bg-gray-900/50">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <span>🤖</span>
                  <span>{data.title}</span>
                </CardTitle>
                <CardDescription className="mt-2">
                  Multi-SDK AI Agents with MCP Tool Integration
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  variant={data.health.status === 'healthy' ? 'default' : 'destructive'}
                  className="text-sm px-4 py-1"
                >
                  <span className="mr-2 h-2 w-2 rounded-full bg-current animate-pulse" />
                  {data?.health?.status?.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Uptime: {formatUptime(data.uptime)}
                </span>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Statistics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Requests"
            value={formatNumber(data.statistics.totalRequests)}
            description="API calls processed"
            icon="📊"
          />
          <StatCard
            title="Active Agents"
            value={data.statistics.totalAgents}
            description="AI agents running"
            icon="🤖"
          />
          <StatCard
            title="Tokens Used"
            value={formatNumber(data.statistics.totalTokensUsed)}
            description="Total LLM tokens"
            icon="🔤"
          />
          <StatCard
            title="Avg Response"
            value={`${data.statistics.averageResponseTime}ms`}
            description="Average response time"
            icon="⚡"
          />
        </div>

        {/* Features Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Features</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              name="OpenAI SDK"
              icon="🔷"
              enabled={data.features.openai.enabled}
              stats={[
                { label: 'Agents', value: data.features.openai.agents },
                { label: 'Models', value: data.features.openai.models.length },
              ]}
            />
            <FeatureCard
              name="Vercel AI SDK"
              icon="▲"
              enabled={data.features.vercel.enabled}
              status={data.features.vercel.status}
              stats={[
                { label: 'Agents', value: data.features.vercel.agents },
              ]}
            />
            <FeatureCard
              name="MCP Servers"
              icon="🔧"
              enabled={data.features.mcp.enabled}
              stats={[
                { label: 'Servers', value: data.features.mcp.servers },
                { label: 'Active', value: data.features.mcp.activeServers },
                { label: 'Tools', value: data.features.mcp.totalTools },
              ]}
            />
            <FeatureCard
              name="WebSockets"
              icon="📡"
              enabled={data.features.webhooks.enabled}
              stats={[
                { label: 'Subscriptions', value: data.features.webhooks.subscriptions },
                { label: 'Connections', value: data.features.webhooks.activeConnections },
              ]}
            />
          </div>
        </div>

        <Separator />

        {/* Quick Links */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Quick Links</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink
              href="/docs"
              title="API Documentation"
              description="Interactive Swagger docs"
              icon="📚"
            />
            <QuickLink
              href="/stats"
              title="Statistics"
              description="Complete server stats"
              icon="📊"
            />
            <QuickLink
              href="/stats/openai"
              title="OpenAI Stats"
              description="OpenAI SDK metrics"
              icon="🔷"
            />
            <QuickLink
              href="/stats/mcp"
              title="MCP Stats"
              description="MCP server metrics"
              icon="🔧"
            />
            <QuickLink
              href="/agents"
              title="Agents"
              description="View all agents"
              icon="🤖"
            />
            <QuickLink
              href="/logs"
              title="Logs"
              description="Server event logs"
              icon="📝"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>AI Agents Server v{data.version} | Made with ❤️ using Bun + Elysia + React</p>
        </div>
      </div>
  )
}
