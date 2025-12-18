# =============================================================================
# Stage 1: deps - Install production dependencies
# =============================================================================
FROM node:22-alpine AS deps

# Install build dependencies for native modules (argon2, better-sqlite3)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# =============================================================================
# Stage 2: builder - Build application with Vite
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and configuration files
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies but keep drizzle-kit for migrations
RUN npm prune --production && npm install drizzle-kit

# =============================================================================
# Stage 3: runner - Minimal runtime with built assets
# =============================================================================
FROM node:22-alpine AS runner

# Install runtime dependencies for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built application from builder stage
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Copy drizzle migrations for database setup
COPY --from=builder --chown=appuser:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=appuser:nodejs /app/drizzle.config.ts ./drizzle.config.ts

# Copy source files needed for seed script
COPY --from=builder --chown=appuser:nodejs /app/src ./src
COPY --from=builder --chown=appuser:nodejs /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script
COPY --chown=appuser:nodejs docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create uploads directory for file storage
RUN mkdir -p /app/uploads && chown -R appuser:nodejs /app/uploads

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set entrypoint and default command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/server/server.js"]
