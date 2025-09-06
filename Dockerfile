# Multi-stage build for pnpm monorepo
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /app

# Copy workspace configuration first
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./

# Copy all package.json files (for dependency resolution)
COPY packages/shared/package.json ./packages/shared/
COPY packages/clients/package.json ./packages/clients/
COPY packages/sheets/package.json ./packages/sheets/
COPY apps/orchestrator/package.json ./apps/orchestrator/

# Install dependencies (will install all workspace deps)
RUN pnpm install --frozen-lockfile

# Copy all source code
COPY packages/ ./packages/
COPY apps/orchestrator/ ./apps/orchestrator/

# Build shared packages first (dependency order matters)
RUN pnpm --filter @ai-platform/shared build
RUN pnpm --filter @ai-platform/clients build
RUN pnpm --filter @ai-platform/sheets build

# Build orchestrator last
RUN pnpm --filter orchestrator build

# Production stage
FROM node:20-alpine AS runtime

# Install pnpm in runtime
RUN npm install -g pnpm@8

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./

# Copy package.json files for production install
COPY packages/shared/package.json ./packages/shared/
COPY packages/clients/package.json ./packages/clients/
COPY packages/sheets/package.json ./packages/sheets/
COPY apps/orchestrator/package.json ./apps/orchestrator/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/clients/dist ./packages/clients/dist
COPY --from=builder /app/packages/sheets/dist ./packages/sheets/dist
COPY --from=builder /app/apps/orchestrator/dist ./apps/orchestrator/dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Cloud Run injects PORT environment variable dynamically
# EXPOSE is documentation only - actual port determined by env.PORT
EXPOSE 9090

# Use the absolute path to the built orchestrator
CMD ["node", "/app/apps/orchestrator/dist/index.js"]