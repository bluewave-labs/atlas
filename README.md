# Atlas

Self-hosted business platform with CRM, HRM, digital signatures, document editor, task management, spreadsheets, file storage, and drawing tools.

## Quick start

```bash
git clone https://github.com/bluewave-labs/atlas.git
cd atlas
chmod +x setup.sh
./setup.sh
```

This will:
1. Generate secure secrets
2. Start PostgreSQL, Redis, and Atlas via Docker
3. Open http://localhost:3001 to create your admin account

## Manual setup

If you prefer to configure manually:

```bash
# 1. Copy and edit environment file
cp .env.example .env
# Edit .env — generate secrets with: openssl rand -hex 32

# 2. Start with Docker Compose
docker compose -f docker-compose.production.yml up -d --build

# 3. Open http://localhost:3001
```

## Development

```bash
# Start database services
docker compose up -d

# Install dependencies
npm install --legacy-peer-deps

# Start dev servers (client + server)
npm run dev
```

- Client: http://localhost:5180
- Server: http://localhost:3001

## Apps

| App | Description |
|-----|-------------|
| CRM | Pipeline, contacts, companies, deals, dashboard |
| HRM | Employees, departments, time-off, attendance |
| Sign | PDF digital signatures with multi-signer support |
| Drive | File storage with versioning and sharing |
| Tables | Spreadsheets with rich field types |
| Tasks | Task management with projects and kanban |
| Write | Document editor with templates |
| Draw | Collaborative drawing canvas |

## Tech stack

- **Frontend**: React, TypeScript, Vite, TanStack Query, Zustand
- **Backend**: Express, TypeScript, Drizzle ORM, PostgreSQL
- **Infrastructure**: Docker, Redis, BullMQ

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key |
| `TOKEN_ENCRYPTION_KEY` | Yes | 64-char hex for AES-256 encryption |
| `DATABASE_URL` | No | PostgreSQL connection (default: localhost) |
| `REDIS_URL` | No | Redis connection for background sync |
| `GOOGLE_CLIENT_ID` | No | Google OAuth for CRM email sync |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth secret |
| `SMTP_HOST` | No | SMTP server for password reset emails |

## License

[Business Source License 1.1](LICENSE) — free for non-production use. Converts to Apache 2.0 after 4 years.
