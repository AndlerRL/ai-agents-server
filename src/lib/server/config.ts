import { ServerConfig } from "~/core/types";

// ============================================================================
// Server Configuration
// ============================================================================

export const config: ServerConfig = {
  environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
  port: parseInt(process.env.PORT || '3001'),
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL,
    organization: process.env.OPENAI_ORGANIZATION
  },
  
  memory: {
    provider: 'memory',
    maxSize: 100000,
    ttl: 3600
  },
  
  chunking: {
    strategy: 'semantic',
    chunkSize: 1000,
    overlap: 200
  }
}