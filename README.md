# Atlas
Self-hosted business platform with CRM, HRM, digital signatures, document editor, task management, spreadsheets, file storage, and drawing tools.

<img width="3422" height="1954" alt="image" src="https://github.com/user-attachments/assets/30a7d84c-5ade-46ac-9192-279050ba20fb" />


## Quick start (Docker)

**macOS / Linux:**
```bash
git clone https://github.com/bluewave-labs/atlas.git
cd atlas
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/bluewave-labs/atlas.git
cd atlas
powershell -ExecutionPolicy Bypass -File setup.ps1
```

This will:
1. Generate secure secrets automatically
2. Start PostgreSQL, Redis, and Atlas via Docker
3. Wait for the service to be healthy

Then open **http://localhost:3001** and create your admin account.

## Manual Docker setup

```bash
# 1. Copy environment file and generate secrets
cp .env.example .env

# Generate and replace the three CHANGE_ME values:
# JWT_SECRET, JWT_REFRESH_SECRET, TOKEN_ENCRYPTION_KEY
# Each: openssl rand -hex 32

# 2. Build and start
docker compose -f docker-compose.production.yml up -d --build

# 3. Open http://localhost:3001
```

## HTTPS with Caddy (optional)

```bash
# 1. Set your domain in .env
echo 'ATLAS_DOMAIN=atlas.yourdomain.com' >> .env

# 2. Point your domain's DNS A record to your server's IP

# 3. Start with HTTPS
docker compose -f docker-compose.production.yml -f docker-compose.https.yml up -d --build
```

Caddy automatically obtains and renews Let's Encrypt SSL certificates. Ports 80 and 443 must be open.

## Development setup

```bash
# 1. Start PostgreSQL and Redis
docker compose up -d

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Create environment file with dev secrets
cp .env.example .env
# Generate secrets (required even for dev):
#   openssl rand -hex 32  → paste into JWT_SECRET
#   openssl rand -hex 32  → paste into JWT_REFRESH_SECRET
#   openssl rand -hex 32  → paste into TOKEN_ENCRYPTION_KEY

# 4. Start dev servers
npm run dev
```

- Client: http://localhost:5180
- Server: http://localhost:3001
- On first visit, you'll be prompted to create an admin account.

## Apps

| App | Description |
|-----|-------------|
| CRM | Pipeline, contacts, companies, deals, dashboard, workflow automations |
| HRM | Employees, departments, leave management, attendance, org chart |
| Sign | PDF digital signatures with multi-signer support and field placement |
| Drive | File storage with folders, versioning, sharing, and file preview |
| Tables | Spreadsheets with rich field types and multiple views |
| Tasks | Task management with projects, kanban, and recurring tasks |
| Write | Document editor with templates and version history |
| Draw | Collaborative drawing canvas |

## Tech stack

- **Frontend**: React, TypeScript, Vite, TanStack Query, Zustand
- **Backend**: Express, TypeScript, Drizzle ORM, PostgreSQL
- **Infrastructure**: Docker, Redis, BullMQ

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | — | JWT signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing key (min 32 chars) |
| `TOKEN_ENCRYPTION_KEY` | Yes | — | 64-char hex string for AES-256 encryption |
| `POSTGRES_PASSWORD` | No | `atlas` | PostgreSQL password (Docker setup) |
| `DATABASE_URL` | No | localhost | PostgreSQL connection string |
| `REDIS_URL` | No | — | Redis connection (enables background sync) |
| `PORT` | No | `3001` | Server port |
| `SERVER_PUBLIC_URL` | No | `http://localhost:3001` | Public URL for the server |
| `CLIENT_PUBLIC_URL` | No | `http://localhost:3001` | Public URL for the client |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth (for CRM email/calendar sync) |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth secret |
| `SMTP_HOST` | No | — | SMTP server for password reset emails |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |

## Troubleshooting

**Build fails with "JavaScript heap out of memory"**

Docker Desktop needs at least 4GB memory. Go to Docker Desktop > Settings > Resources > Memory and increase it.

**"network ... not found" error**

```bash
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d --build
```

**Build uses cached old Dockerfile after `git pull`**

```bash
docker compose -f docker-compose.production.yml build --no-cache atlas
docker compose -f docker-compose.production.yml up -d
```

**Port 3001 already in use**

Stop the process using port 3001, or set a different port in `.env`:
```
PORT=3002
```

**Blank page after login (no UI)**

This was fixed in recent versions. Pull the latest code and rebuild:
```bash
git pull
docker compose -f docker-compose.production.yml up -d --build
```

## System requirements

### Minimum

- 2 GB RAM + 4 GB swap (or 4 GB RAM)
- 1 vCPU
- 10 GB disk
- Docker 20+ with Compose plugin

### Recommended

- 4 GB RAM
- 2 vCPU
- 20 GB disk

### Supported platforms

| Platform | Architecture | Status |
|----------|-------------|--------|
| Ubuntu / Debian / CentOS | x86_64 (amd64) | Full support |
| AWS EC2, DigitalOcean, Hetzner, Linode | amd64 | Full support |
| AWS Graviton, Oracle Cloud Ampere | arm64 | Full support |
| Apple Silicon Mac (M1–M4) | arm64 | Full support |
| Raspberry Pi 5 (8 GB) | arm64 | Supported (slower builds) |
| Raspberry Pi 4 (8 GB) | arm64 | Supported (needs swap, slow builds) |
| Windows (WSL2 + Docker Desktop) | amd64 | Supported |

### Not supported

| Platform | Reason |
|----------|--------|
| Raspberry Pi 3 / Zero / Zero 2 W | 32-bit ARM — Node 20 requires arm64 |
| Machines with < 2 GB RAM and no swap | Build and runtime will OOM |
| 32-bit x86 (i386) | Docker images are 64-bit only |

> **Tip:** On 2 GB machines, add swap before building:
> ```bash
> sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

## License

[Business Source License 1.1](LICENSE) — free for non-production use. Converts to Apache 2.0 after 4 years.
