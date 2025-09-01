/**
 * Database Connection and Configuration for RAG Systems
 * Handles PostgreSQL with pgvector extension
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import * as schema from './schema'

// ============================================================================
// Database Configuration
// ============================================================================

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
  maxConnections?: number
  idleTimeout?: number
  connectTimeout?: number
}

// ============================================================================
// Database Connection
// ============================================================================

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let connection: postgres.Sql | null = null

export function createDatabaseConnection(config: DatabaseConfig) {
  if (connection) {
    return { db: db!, connection }
  }

  const connectionString = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`
  
  // Create PostgreSQL connection
  connection = postgres(connectionString, {
    max: config.maxConnections || 20,
    idle_timeout: config.idleTimeout || 20,
    connect_timeout: config.connectTimeout || 60,
    ssl: config.ssl ? 'require' : false,
    
    // Enable prepared statements for better performance
    prepare: true,
    
    // Transform PostgreSQL types
    transform: {
      undefined: null,
    },
    
    // Handle pgvector types
    types: {
      // Handle vector type
      vector: {
        to: 1184,
        from: [1184],
        serialize: (x: number[]) => `[${x.join(',')}]`,
        parse: (x: string) => x.slice(1, -1).split(',').map(Number),
      },
    },
  })

  // Create Drizzle instance
  db = drizzle(connection, { 
    schema,
    logger: process.env.NODE_ENV === 'development'
  })

  return { db, connection }
}

export function getDatabaseConnection() {
  if (!db || !connection) {
    throw new Error('Database connection not initialized. Call createDatabaseConnection first.')
  }
  return { db, connection }
}

export async function closeDatabaseConnection() {
  if (connection) {
    await connection.end()
    connection = null
    db = null
  }
}

// ============================================================================
// Database Initialization
// ============================================================================

export async function initializeDatabase() {
  const { connection } = getDatabaseConnection()
  
  try {
    console.log('🔧 Initializing database with pgvector...')
    
    // Enable pgvector extension
    await connection`CREATE EXTENSION IF NOT EXISTS vector`
    
    // Enable other useful extensions
    await connection`CREATE EXTENSION IF NOT EXISTS pg_trgm` // For full-text search
    await connection`CREATE EXTENSION IF NOT EXISTS btree_gin` // For GIN indexes
    await connection`CREATE EXTENSION IF NOT EXISTS pg_stat_statements` // For query performance monitoring
    
    console.log('✅ Database extensions enabled successfully')
    
    // Test vector operations
    const testResult = await connection`SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector as distance`
    console.log(`✅ Vector operations test successful. Distance: ${testResult[0].distance}`)
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  }
}

// ============================================================================
// Database Configuration from Environment
// ============================================================================

export function getDatabaseConfigFromEnv(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL
  
  if (databaseUrl) {
    // Parse DATABASE_URL
    const url = new URL(databaseUrl)
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
      ssl: url.searchParams.get('sslmode') === 'require',
    }
  }
  
  // Fall back to individual environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_agents_rag',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '60'),
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  latency: number
  version: string
  extensions: string[]
  error?: string
}> {
  try {
    const { connection } = getDatabaseConnection()
    const start = Date.now()
    
    // Check basic connectivity and get version
    const [versionResult] = await connection`SELECT version() as version`
    
    // Check extensions
    const extensionsResult = await connection`
      SELECT extname 
      FROM pg_extension 
      WHERE extname IN ('vector', 'pg_trgm', 'btree_gin', 'pg_stat_statements')
    `
    
    const latency = Date.now() - start
    
    return {
      healthy: true,
      latency,
      version: versionResult.version,
      extensions: extensionsResult.map((row: any) => row.extname),
    }
  } catch (error) {
    return {
      healthy: false,
      latency: -1,
      version: '',
      extensions: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export { schema }
