FROM oven/bun:1.1 AS base

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose port (Railway sets PORT env var)
EXPOSE 3000

# Start the service
CMD ["bun", "run", "index.ts"]
