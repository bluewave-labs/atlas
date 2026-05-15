# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root config files
COPY package.json package-lock.json tsconfig.base.json ./

# Copy workspace package.json files for dependency resolution
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code (cache-bust: changes to any source invalidates build)
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/client packages/client
ARG CACHE_BUST=1

# Build shared types first (other packages depend on it)
RUN cd packages/shared && npx tsc --skipLibCheck

# Build client (vite build handles its own TS compilation)
RUN cd packages/client && NODE_OPTIONS="--max-old-space-size=4096" npx vite build

# Build server (tsc — increase heap for large type-heavy codebase)
RUN cd packages/server && NODE_OPTIONS="--max-old-space-size=4096" npx tsc --skipLibCheck

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Copy root config files for workspace resolution
COPY package.json package-lock.json ./

# Copy workspace package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/client/dist packages/client/dist
# SQL migration files — tsc skips non-TS assets, so copy them next to the compiled JS.
# bootstrapDatabase reads .sql files from this dir on every start (see packages/server/src/db/bootstrap.ts).
COPY packages/server/src/db/migrations/*.sql packages/server/dist/db/migrations/
# Locale JSONs — server loads them at runtime for seeded-workflow i18n
COPY --from=builder /app/packages/client/src/i18n/locales packages/client/src/i18n/locales

# Patch shared package.json to point to compiled JS (source .ts is not available in production)
RUN sed -i 's|"main": "./src/index.ts"|"main": "./dist/index.js"|' packages/shared/package.json && \
    sed -i 's|"types": "./src/index.ts"|"types": "./dist/index.d.ts"|' packages/shared/package.json

# Create persistent data directories
RUN mkdir -p /app/data /app/packages/server/uploads

# Copy entrypoint script (auto-detects public IP)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# Create non-root user
RUN addgroup -g 1001 atlas && adduser -u 1001 -G atlas -s /bin/sh -D atlas
RUN chown -R atlas:atlas /app
USER atlas

ENV NODE_ENV=production
ENV CLIENT_PUBLIC_URL=http://localhost:3001
ENV CORS_ORIGINS=http://localhost:3001
EXPOSE 3001

# Health check against the existing /api/v1/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "packages/server/dist/index.js"]
