import { PrismaClient } from '@prisma/client'

// PrismaClient singleton - prevents connection pool exhaustion
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set!')
}

// Validate DATABASE_URL format - must be a PostgreSQL URL for this project
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error(`[DB] Invalid DATABASE_URL format: "${databaseUrl.substring(0, 20)}..." - Must start with postgresql:// or postgres://`)
  throw new Error('DATABASE_URL must be a PostgreSQL connection string starting with postgresql:// or postgres://')
}

// Reuse existing client or create new one
const client = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
  datasourceUrl: databaseUrl,
})

// Store in global for hot reload (development)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = client
}

export const db = client
