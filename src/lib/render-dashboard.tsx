/**
 * Server-Side Rendering helper for React Dashboard
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import { Dashboard, type DashboardData } from '../components/dashboard'

export function getClientFilename(): string {
  try {
    const manifestPath = join(process.cwd(), 'public', 'manifest.json')
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      return manifest.clientJs || 'client.js'
    }
  } catch (error) {
    console.error('Error reading manifest:', error)
  }
  return 'client.js'
}

export function renderDashboard(data: DashboardData): string {
  const clientFilename = getClientFilename()
  const appHtml = renderToString(<Dashboard data={data} />)
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
  <link rel="stylesheet" href="/client.css">
  <script>
    // Inject dashboard data for client-side hydration
    window.__DASHBOARD_DATA__ = ${JSON.stringify(data)};
  </script>
</head>
<body class="dark">
  <div id="root">${appHtml}</div>
  <script type="module" src="/${clientFilename}"></script>
</body>
</html>`
}
