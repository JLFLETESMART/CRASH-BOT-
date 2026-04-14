# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only dependency manifests first (better layer caching)
COPY package*.json ./

# Install build dependencies required by native Node modules (e.g. better-sqlite3),
# install all deps with lifecycle scripts enabled, then prune dev-only packages
RUN apk add --no-cache python3 make g++ && \
    npm ci && \
    npm prune --omit=dev

# Copy source code
COPY . .

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001

# Copy pruned production node_modules and package manifests from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy source files
COPY --from=builder /app/src ./src

# Create persistent directories and hand ownership to the non-root user
RUN mkdir -p /app/data /app/logs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose health-check port
EXPOSE 3000

# Health check – polls the /health endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Use dumb-init as PID 1 to forward signals correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
