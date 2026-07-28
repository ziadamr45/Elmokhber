import { PrismaClient } from '@prisma/client'

// PrismaClient singleton - prevents connection pool exhaustion
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set!')
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
