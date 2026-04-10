# Atlas infrastructure and deployment

This document covers the full infrastructure stack, deployment process, CI/CD pipeline, and operational procedures for self-hosting Atlas.

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Docker setup](#docker-setup)
3. [Production deployment](#production-deployment)
4. [Environment variables](#environment-variables)
5. [SSL/HTTPS](#sslhttps)
6. [CI/CD pipeline](#cicd-pipeline)
7. [Atlas CLI](#atlas-cli)
8. [Backup and restore](#backup-and-restore)
9. [Monitoring](#monitoring)
10. [Updating](#updating)
11. [Troubleshooting](#troubleshooting)

---

## Architecture overview

Atlas runs as a set of containerized services orchestrated by Docker Compose. In production, four services work together:

```
                 ┌──────────────┐
   Internet      │    Caddy     │  (optional — HTTPS only)
   :80/:443  ──> │  reverse     │
                 │  proxy       │
                 └──────┬───────┘
                        │ :3001
                 ┌──────▼───────┐
                 │    Atlas     │  Express + static client
                 │   (Node.js)  │
                 └──┬───────┬───┘
                    │       │
           :5432    │       │  :6379
        ┌───────────▼┐  ┌──▼──────────┐
        │ PostgreSQL  │  │    Redis    │
        │  16-alpine  │  │  7-alpine   │
        └─────────────┘  └─────────────┘
```

### Services

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| **Atlas** | `ghcr.io/gorkem-bwl/atlas:latest` | Express API server serving both the REST API and the built React client as static files | 3001 |
| **PostgreSQL** | `postgres:16-alpine` | Primary data store for all application data | 5432 (internal) |
| **Redis** | `redis:7-alpine` | Session caching, rate limiting, and pub/sub | 6379 (internal) |
| **Caddy** | `caddy:2-alpine` | Automatic HTTPS reverse proxy with Let's Encrypt | 80, 443 |

### How they connect

- The **Atlas** container connects to PostgreSQL via `postgresql://atlas:<password>@postgres:5432/atlas` and to Redis via `redis://redis:6379`. Both are resolved by Docker's internal DNS using service names.
- **Caddy** reverse-proxies all traffic from the public domain (ports 80/443) to `atlas:3001` inside the Docker network. It handles TLS termination automatically.
- In development, PostgreSQL and Redis expose their ports to the host (`5432`, `6379`) so the app running on the host can connect directly. In production, only port 3001 (or 80/443 when Caddy is used) is exposed.

---

## Docker setup

### Multi-stage build

The `Dockerfile` uses a two-stage build to minimize the production image size:

**Stage 1 — Builder** (`node:20-alpine`)

1. Copies workspace `package.json` files for all three packages (shared, server, client).
2. Runs `npm ci --legacy-peer-deps` to install all dependencies (including dev).
3. Builds in dependency order:
   - `packages/shared` — TypeScript compilation (`tsc --skipLibCheck`)
   - `packages/client` — Vite production build (`vite build`)
   - `packages/server` — TypeScript compilation with increased heap (`NODE_OPTIONS="--max-old-space-size=4096"`)

**Stage 2 — Production** (`node:20-alpine`)

1. Installs `dumb-init` for proper PID 1 signal handling.
2. Copies only workspace root and package-level `package.json` files.
3. Runs `npm ci --legacy-peer-deps --omit=dev` for production-only dependencies.
4. Copies built artifacts from the builder stage:
   - `packages/shared/dist` — compiled shared types
   - `packages/server/dist` — compiled server code
   - `packages/client/dist` — built React SPA
5. Patches `packages/shared/package.json` to point `main` and `types` to the compiled `.js`/`.d.ts` files (source `.ts` files are not present in the production image).
6. Creates persistent directories: `/app/data` and `/app/packages/server/uploads`.
7. Creates a non-root `atlas` user (UID/GID 1001) and sets file ownership.
8. Sets `NODE_ENV=production` and exposes port 3001.
9. Includes a Docker `HEALTHCHECK` that pings `http://localhost:3001/api/v1/health` every 30 seconds.
10. Runs the server via `dumb-init` as the entrypoint: `node packages/server/dist/index.js`.

### Docker Compose files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **Development only.** Starts PostgreSQL and Redis with ports exposed to the host. No Atlas container — the app runs directly on the host via `npm run dev`. |
| `docker-compose.production.yml` | **Production.** Runs Atlas (from GHCR image), PostgreSQL, and Redis. All services use named volumes for persistence. |
| `docker-compose.https.yml` | **HTTPS overlay.** Adds Caddy as a reverse proxy. Composed on top of the production file. |

---

## Production deployment

### Prerequisites

- A Linux server (Ubuntu 20.04+, Debian 11+, CentOS 8+, or Amazon Linux 2)
- At least 2 GB of RAM
- Docker and Docker Compose installed (the installer will auto-install Docker if missing)
- Ports 80 and 443 open if using HTTPS, or port 3001 for HTTP-only

### One-line install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/gorkem-bwl/Atlas/main/install.sh)
```

### Unattended install

```bash
ATLAS_DOMAIN=atlas.example.com \
ATLAS_EMAIL=admin@example.com \
  bash <(curl -fsSL https://raw.githubusercontent.com/gorkem-bwl/Atlas/main/install.sh)
```

### What the installer does (step by step)

1. **Pre-flight checks** — verifies Docker is installed and running (auto-installs if missing), checks Docker Compose, validates minimum 2 GB RAM, checks that ports 80, 443, and 3001 are available.
2. **Setup** — creates the installation directory (defaults to `./atlas`), creates `atlas-data/backups` for database backups.
3. **Interactive configuration** — prompts for:
   - **Domain** — a custom domain (enables HTTPS via Caddy) or `localhost` for HTTP-only.
   - **Admin email** — used for Let's Encrypt certificates and as the initial admin account.
   - **Database password** — user-provided or auto-generated (24-character base64 string).
4. **Secret generation** — auto-generates `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `TOKEN_ENCRYPTION_KEY` using `openssl rand -hex 32`.
5. **Writes `.env`** — creates the environment file with all configuration values.
6. **Downloads compose files** — fetches `docker-compose.production.yml`, `docker-compose.https.yml`, and the `atlas` CLI tool from the GitHub repository.
7. **Pulls images** — downloads the Atlas image from `ghcr.io/gorkem-bwl/atlas:latest`, plus PostgreSQL 16 and Redis 7 images.
8. **Starts services** — runs `docker compose -f docker-compose.production.yml up -d`.
9. **Health check** — polls `http://localhost:3001/api/v1/health` for up to 60 seconds until Atlas responds.
10. **Starts Caddy** (if a domain was configured) — runs the HTTPS overlay compose file to start Caddy with automatic SSL.
11. **Installs CLI** — copies the `atlas` script to `/usr/local/bin/atlas` for system-wide access.
12. **Prints summary** — displays the access URL, admin email, and useful commands.

### Post-install directory structure

```
atlas/
  .env                              # Configuration (secrets, domain, URLs)
  docker-compose.production.yml     # Production compose file
  docker-compose.https.yml          # HTTPS overlay
  atlas                             # CLI management tool
  atlas-data/
    backups/                        # Database backup files
```

---

## Environment variables

All environment variables are validated at server startup using Zod schema in `packages/server/src/config/env.ts`. The server will fail to start if required variables are missing or malformed.

### Required variables

| Variable | Description | Format | Example |
|----------|-------------|--------|---------|
| `JWT_SECRET` | Signing key for access tokens (1-hour expiry) | String, minimum 32 characters | `a1b2c3d4...` (64 hex chars) |
| `JWT_REFRESH_SECRET` | Signing key for refresh tokens (30-day expiry) | String, minimum 32 characters | `e5f6a7b8...` (64 hex chars) |
| `TOKEN_ENCRYPTION_KEY` | AES-256 encryption key for sensitive token storage | 64-character hex string (32 bytes) | `0123456789abcdef...` |

### Optional variables with defaults

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `development` (set to `production` in Docker) |
| `PORT` | Express server listen port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/atlas` |
| `REDIS_URL` | Redis connection string | *(not set — Redis features are disabled when absent)* |
| `SERVER_PUBLIC_URL` | Public-facing URL for the server (used in emails, OAuth callbacks) | `http://localhost:3001` |
| `CLIENT_PUBLIC_URL` | Public-facing URL for the client (used for CORS and redirects) | `http://localhost:3001` |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3001,http://localhost:5180` |
| `PLATFORM_PUBLIC_URL` | Alternative public URL for platform-level features | *(not set)* |

### SMTP (email) variables

All optional. Required only for password reset emails and other transactional emails.

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | *(not set)* |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP authentication username | *(not set)* |
| `SMTP_PASS` | SMTP authentication password | *(not set)* |
| `SMTP_FROM` | Sender address for outgoing emails | `Atlas <noreply@atlas.so>` |

### Google OAuth variables

All optional. Required only for CRM email/calendar sync features.

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | *(not set)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | *(not set)* |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | *(not set)* |

### Production-specific variables (set in Docker Compose)

These are set automatically by `docker-compose.production.yml` and should not be manually configured:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://atlas:<password>@postgres:5432/atlas` | Uses Docker internal DNS |
| `REDIS_URL` | `redis://redis:6379` | Uses Docker internal DNS |
| `NODE_ENV` | `production` | Set in compose environment |

### Installer-specific variables

These are only used in the `.env` file and consumed by Docker Compose, not by the Atlas server directly:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password (passed to both the postgres container and the Atlas DATABASE_URL) |
| `ATLAS_DOMAIN` | Domain name for Caddy HTTPS (e.g., `atlas.example.com` or `localhost`) |
| `ATLAS_ADMIN_EMAIL` | Admin email address |
| `IMAGE_TAG` | Docker image tag to pull (default: `latest`, can be set to a version like `v1.0.0`) |

---

## SSL/HTTPS

Atlas uses [Caddy](https://caddyserver.com/) for automatic HTTPS with zero configuration.

### How it works

1. Caddy runs as a reverse proxy in front of the Atlas container.
2. When started with a real domain, Caddy automatically obtains a TLS certificate from Let's Encrypt using the ACME HTTP-01 challenge.
3. Certificates are renewed automatically before expiry (Caddy handles this internally).
4. Certificate data is persisted in the `atlas-caddy-data` Docker volume.

### Setup

1. Point your domain's DNS A record to your server's public IP address.
2. Set `ATLAS_DOMAIN` in `.env` to your domain (e.g., `atlas.example.com`).
3. Ensure ports 80 and 443 are open on your firewall.
4. Start with both compose files:

```bash
docker compose \
  -f docker-compose.production.yml \
  -f docker-compose.https.yml \
  up -d
```

Or use the Atlas CLI (which detects the domain and includes the HTTPS overlay automatically):

```bash
atlas start
```

### Caddy configuration

The HTTPS overlay uses a one-liner Caddy command rather than a Caddyfile:

```
caddy reverse-proxy --from ${ATLAS_DOMAIN} --to atlas:3001
```

This automatically:
- Listens on ports 80 and 443.
- Redirects HTTP to HTTPS.
- Obtains and renews Let's Encrypt certificates.
- Proxies all traffic to the Atlas container on port 3001.

### Disabling HTTPS

To run without HTTPS (e.g., behind an existing reverse proxy), set `ATLAS_DOMAIN=localhost` in `.env` and use only the production compose file:

```bash
docker compose -f docker-compose.production.yml up -d
```

---

## CI/CD pipeline

Atlas uses two GitHub Actions workflows.

### Tests workflow (`.github/workflows/test.yml`)

**Triggers:** Push to `main`, pull requests targeting `main`.

Three parallel jobs run on every push/PR:

#### Unit tests

- Sets up Node.js 20.
- Installs dependencies and builds the shared package.
- Runs `npm test` for both `packages/server` and `packages/client`.

#### Integration tests

- Spins up a PostgreSQL 16 service container (`atlas_test` database).
- Sets test environment variables (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`).
- Runs `npm run test:integration` in the server package.

#### E2E tests

- Spins up a PostgreSQL 16 service container (`atlas_e2e` database).
- Installs Playwright with Chromium.
- Runs `npm run test:e2e`.
- On failure, uploads the Playwright report as a GitHub artifact (retained for 7 days).

### Docker build workflow (`.github/workflows/docker.yml`)

**Triggers:** Push to `main`, git tags matching `v*`, manual workflow dispatch.

Single job that:

1. **Checks out** the repository.
2. **Sets up QEMU** for multi-platform builds (linux/amd64 + linux/arm64).
3. **Sets up Docker Buildx** for advanced build features.
4. **Logs in** to GitHub Container Registry (GHCR) using `GITHUB_TOKEN`.
5. **Extracts metadata** for tagging:
   - `latest` — on every push to main or version tag.
   - Short SHA (e.g., `ad46268`) — on every build.
   - Semver tags (e.g., `1.0.0`, `1.0`, `1`) — on version tags.
6. **Builds and pushes** a multi-platform image to `ghcr.io/gorkem-bwl/atlas`.
   - Uses GitHub Actions cache (`type=gha`) for layer caching.
   - Generates provenance attestations and SBOM for supply-chain security.
7. **Runs Trivy** vulnerability scanner against the published image (warn-only, does not block the build).
8. **Prints summary** with image details and tags to the GitHub Actions job summary.

### Image registry

- **Registry:** `ghcr.io/gorkem-bwl/atlas`
- **Platforms:** `linux/amd64`, `linux/arm64`
- **Tags:** `latest`, short SHA, semver (when tagged)

To pin a specific version:

```bash
IMAGE_TAG=v1.0.0 docker compose -f docker-compose.production.yml up -d
```

---

## Atlas CLI

The `atlas` CLI is a Bash script that provides management commands for a self-hosted Atlas installation. CLI version: `1.0.0`.

### Installation

The CLI is installed automatically by `install.sh`. To install manually:

```bash
sudo cp atlas /usr/local/bin/atlas
```

### Directory detection

The CLI searches for the Atlas installation directory in this order:

1. `$ATLAS_DIR` environment variable
2. Current directory (looks for `docker-compose.production.yml`)
3. Common paths: `~/atlas`, `/opt/atlas`, `/srv/atlas`, `~/Atlas`, `/root/atlas`
4. Parent directory

### Commands

#### `atlas start`

Start all services (PostgreSQL, Redis, Atlas, and Caddy if a domain is configured).

```bash
atlas start
```

#### `atlas stop`

Stop all services.

```bash
atlas stop
```

#### `atlas restart`

Stop and restart all services.

```bash
atlas restart
```

#### `atlas status`

Show detailed service status including container states, health checks for Atlas API, PostgreSQL, and Redis, plus Docker disk usage.

```bash
atlas status
```

#### `atlas logs [service]`

Tail logs in real-time. Defaults to all services. Press `Ctrl+C` to stop.

```bash
atlas logs            # All services
atlas logs atlas      # Atlas app only
atlas logs postgres   # PostgreSQL only
atlas logs redis      # Redis only
atlas logs caddy      # Caddy only
```

To disable following (print and exit):

```bash
ATLAS_LOGS_FOLLOW="" atlas logs
```

#### `atlas update`

Pull the latest Atlas image from GHCR, download updated compose files, and restart all services.

```bash
atlas update
```

What it does:
1. Downloads latest `docker-compose.production.yml`, `docker-compose.https.yml`, and `Dockerfile` from the main branch.
2. Pulls `ghcr.io/gorkem-bwl/atlas:latest`.
3. Stops and restarts all services.
4. Waits up to 60 seconds for health check to pass.

#### `atlas backup`

Create a gzipped PostgreSQL dump.

```bash
atlas backup
```

#### `atlas restore <file>`

Restore the database from a backup file. Requires confirmation. Stops Atlas during restore to prevent writes.

```bash
atlas restore atlas-data/backups/atlas_20240115_120000.sql.gz
```

#### `atlas reset-password <email>`

Reset a user's password directly in the database. Prompts for the new password interactively.

```bash
atlas reset-password admin@example.com
```

#### `atlas configure`

Re-run interactive configuration. Allows changing:
- Domain name
- Admin email
- Database password
- JWT secrets (will log out all users)

```bash
atlas configure
```

#### `atlas version`

Show CLI version, installation directory, and version info for all running services (Atlas, PostgreSQL, Redis, Caddy).

```bash
atlas version
```

#### `atlas uninstall`

Stop all services and remove containers. Data is preserved in Docker volumes. Requires typing `uninstall` to confirm.

```bash
atlas uninstall
```

### Environment variables for the CLI

| Variable | Description |
|----------|-------------|
| `ATLAS_DIR` | Override automatic install directory detection |
| `ATLAS_LOGS_FOLLOW` | Set to empty string to disable log following |

---

## Backup and restore

### Creating backups

```bash
atlas backup
```

This runs `pg_dump` inside the PostgreSQL container, compresses the output with gzip, and saves it to:

```
<install-dir>/atlas-data/backups/atlas_YYYYMMDD_HHMMSS.sql.gz
```

The dump uses `--format=plain --no-owner --no-privileges` for maximum portability.

### Automatic retention

After each backup, the CLI automatically deletes backup files older than 7 days from the backups directory.

### Scheduled backups

Atlas does not include a built-in backup scheduler. Use cron to schedule regular backups:

```bash
# Daily backup at 2:00 AM
0 2 * * * cd /path/to/atlas && ./atlas backup >> /var/log/atlas-backup.log 2>&1
```

### Restoring from backup

```bash
atlas restore atlas-data/backups/atlas_20240115_120000.sql.gz
```

The restore process:

1. Prompts for confirmation (type `yes`).
2. Stops the Atlas container to prevent writes during restore.
3. Ensures PostgreSQL is running.
4. Drops and recreates the `atlas` database.
5. Decompresses and pipes the SQL into `psql` inside the PostgreSQL container.
6. Restarts all services.
7. Waits for Atlas to become healthy (up to 30 seconds).

Backups can also be plain SQL files (not gzipped) — the restore command detects the format automatically.

### Manual backup and restore

If the CLI is unavailable, you can use Docker commands directly:

```bash
# Backup
docker exec atlas-postgres pg_dump -U atlas -d atlas --no-owner --no-privileges | gzip > backup.sql.gz

# Restore
docker exec atlas-postgres psql -U atlas -d postgres -c "DROP DATABASE IF EXISTS atlas;"
docker exec atlas-postgres psql -U atlas -d postgres -c "CREATE DATABASE atlas OWNER atlas;"
gunzip -c backup.sql.gz | docker exec -i atlas-postgres psql -U atlas -d atlas
```

---

## Monitoring

### Health endpoint

Atlas exposes a health check endpoint:

```
GET /api/v1/health
```

The Docker container includes a built-in `HEALTHCHECK` directive that pings this endpoint every 30 seconds with a 5-second timeout and 3 retries, starting after a 10-second grace period.

Check health manually:

```bash
curl http://localhost:3001/api/v1/health
```

Or use the CLI:

```bash
atlas status
```

The `atlas status` command checks:
- Atlas API health endpoint
- PostgreSQL readiness (`pg_isready`)
- Redis ping (`redis-cli ping`)
- Caddy container status (if running)
- Docker disk usage

### Logs

View logs for all services or a specific service:

```bash
atlas logs              # All services, following
atlas logs atlas        # Atlas app only
atlas logs postgres     # PostgreSQL only
```

Or use Docker Compose directly:

```bash
docker compose -f docker-compose.production.yml logs --follow --tail=100 atlas
```

### Container health status

Docker tracks container health status. Check it with:

```bash
docker inspect atlas --format '{{.State.Health.Status}}'
# Returns: healthy, unhealthy, or starting
```

### Service-level checks

| Service | Check command |
|---------|--------------|
| Atlas | `curl -sf http://localhost:3001/api/v1/health` |
| PostgreSQL | `docker exec atlas-postgres pg_isready -U atlas -d atlas` |
| Redis | `docker exec atlas-redis redis-cli ping` |
| Caddy | `docker ps --filter name=atlas-caddy --format '{{.Status}}'` |

---

## Updating

### Using the CLI

```bash
atlas update
```

This performs a zero-config rolling update:

1. Downloads the latest compose files and Dockerfile from the main branch on GitHub.
2. Pulls the latest Docker image from `ghcr.io/gorkem-bwl/atlas:latest`.
3. Stops all services with `docker compose down`.
4. Starts all services with `docker compose up -d`.
5. Waits for health check (up to 60 seconds).

Database migrations run automatically on server startup (`CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` patterns ensure idempotency), so no manual migration step is needed after updating.

### Pinning a version

To use a specific version instead of `latest`:

```bash
IMAGE_TAG=v1.0.0 docker compose -f docker-compose.production.yml up -d
```

### Manual update

```bash
cd /path/to/atlas

# Pull latest image
docker compose -f docker-compose.production.yml pull

# Restart
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### Rollback

To roll back to a previous version, specify the image tag:

```bash
IMAGE_TAG=v0.9.0 docker compose -f docker-compose.production.yml up -d
```

Or use a specific SHA:

```bash
IMAGE_TAG=ad46268 docker compose -f docker-compose.production.yml up -d
```

---

## Troubleshooting

### Atlas does not start

**Symptoms:** `atlas status` shows the Atlas container is not running or unhealthy.

```bash
# Check container logs
atlas logs atlas

# Check if required env vars are set
docker exec atlas env | grep -E 'JWT_SECRET|DATABASE_URL|TOKEN_ENCRYPTION_KEY'

# Verify the .env file has all required secrets
cat .env
```

Common causes:
- Missing or malformed `TOKEN_ENCRYPTION_KEY` (must be exactly 64 hex characters).
- `JWT_SECRET` or `JWT_REFRESH_SECRET` shorter than 32 characters.
- PostgreSQL not ready when Atlas starts (should be handled by `depends_on` health checks, but can fail if PostgreSQL is slow to initialize on first run).

### Cannot connect to PostgreSQL

**Symptoms:** Atlas logs show `ECONNREFUSED` or `connection refused` for the database.

```bash
# Check if PostgreSQL is running and healthy
docker exec atlas-postgres pg_isready -U atlas -d atlas

# Check PostgreSQL logs
atlas logs postgres

# Verify DATABASE_URL
docker exec atlas printenv DATABASE_URL
```

Common causes:
- PostgreSQL container is still initializing (first run can take 10-30 seconds).
- `POSTGRES_PASSWORD` in `.env` was changed after the PostgreSQL data volume was created. Fix: remove the volume and recreate (`docker volume rm atlas-pg-data`), then restore from backup.

### Port conflicts

**Symptoms:** `bind: address already in use` errors.

```bash
# Check what is using the port
ss -tlnp | grep -E ':80|:443|:3001'
# or
lsof -i :3001
```

Solutions:
- Stop the conflicting service.
- Change the Atlas port in `.env` by setting `PORT=3002` and updating compose accordingly.
- If using an existing reverse proxy (nginx, Apache), skip Caddy and only use `docker-compose.production.yml`.

### SSL certificate issues

**Symptoms:** Caddy logs show ACME errors or the site is not accessible via HTTPS.

```bash
atlas logs caddy
```

Common causes:
- DNS A record does not point to the server's IP. Verify with `dig atlas.example.com`.
- Ports 80 or 443 are blocked by a firewall. Caddy needs both for the ACME HTTP-01 challenge.
- Rate limits from Let's Encrypt (max 5 duplicate certificates per week). Wait and retry.

### High memory usage

Atlas requires at least 2 GB of RAM for the full stack. If the server is memory-constrained:

```bash
# Check memory usage per container
docker stats --no-stream
```

### Docker permission errors

**Symptoms:** `permission denied` when running Docker commands.

```bash
# Add current user to the docker group
sudo usermod -aG docker $USER

# Apply without re-login
newgrp docker
```

### Resetting everything

To completely remove Atlas and start fresh:

```bash
atlas uninstall

# Remove data volumes (THIS DELETES ALL DATA)
docker volume rm atlas-pg-data atlas-redis-data atlas-uploads atlas-caddy-data atlas-caddy-config

# Remove installation directory
rm -rf /path/to/atlas

# Reinstall
bash <(curl -fsSL https://raw.githubusercontent.com/gorkem-bwl/Atlas/main/install.sh)
```

### Checking container resource usage

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

### Accessing the database directly

```bash
docker exec -it atlas-postgres psql -U atlas -d atlas
```

### Viewing Atlas environment

```bash
docker exec atlas env | sort
```
