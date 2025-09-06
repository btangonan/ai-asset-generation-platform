# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY apps/orchestrator/package.json ./apps/orchestrator/
COPY packages/*/package.json ./packages/*/

# Install pnpm and dependencies
RUN npm install -g pnpm@8
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build
RUN pnpm --filter orchestrator build

# Production stage
FROM node:20-alpine AS runtime

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files for production dependencies
COPY package.json pnpm-workspace.yaml ./
COPY apps/orchestrator/package.json ./apps/orchestrator/
COPY packages/*/package.json ./packages/*/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/apps/orchestrator/dist ./apps/orchestrator/dist
COPY --from=builder /app/packages/*/dist ./packages/*/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 9090

CMD ["node", "apps/orchestrator/dist/index.js"]