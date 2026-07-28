FROM oven/bun:latest AS base

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (without --frozen-lockfile to avoid version issues)
RUN bun install

# Copy source code
COPY . .

# Generate Prisma client (for game-rooms only - has prisma schema)
RUN bunx prisma generate || true

# Expose port (Railway sets PORT env var)
EXPOSE 3000

# Start the service
CMD ["bun", "run", "index.ts"]
