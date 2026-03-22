import { PrismaClient } from '@prisma/client'

// Force version to bust cache
const FORCE_VERSION = 'v14_explicit_url_' + Date.now()

console.log('[DB] Initializing PrismaClient, version:', FORCE_VERSION)
console.log('[DB] DATABASE_URL starts with postgresql:', process.env.DATABASE_URL?.startsWith('postgresql'))

// PrismaClient singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create fresh client with explicit URL
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set!')
}

const client = new PrismaClient({
  log: ['error'],
  datasourceUrl: databaseUrl,
})

// Log available spy models
console.log('[DB] spyRoom available:', 'spyRoom' in client)
console.log('[DB] spyPlayer available:', 'spyPlayer' in client)
console.log('[DB] spyGame available:', 'spyGame' in client)

// Store in global for hot reload
globalForPrisma.prisma = client

export const db = client
