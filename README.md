# Atlas
Self-hosted business platform with inter-connected CRM, HRM, digital signatures, document editor, task management, spreadsheets, file storage, and drawing tools, all can be used by the same team.

Atlas can also deploy several 3rd party apps, including [Activepieces](https://www.activepieces.com/), [Cal.com](http://cal.com/), [Formbricks](http://formbricks.com/), [Mattermost](http://mattermost.com/), [Umami](https://umami.is/) and [Checkmate](https://checkmate.so/).

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
git clone https://github.com/bluewave-labs/atlas.git
cd atlas
docker compose -f docker-compose.production.yml up -d
```

Open **http://localhost:3001** and create your admin account. Secrets are auto-generated on first run.

To pin a specific version: `IMAGE_TAG=1.6.0 docker compose -f docker-compose.production.yml up -d`

## HTTPS with Caddy (optional)

```bash
# 1. Set your domain in .env
echo 'ATLAS_DOMAIN=atlas.yourdomain.com' >> .env

# 2. Point your domain's DNS A record to your server's IP

# 3. Start with HTTPS
docker compose -f docker-compose.production.yml -f docker-compose.https.yml up -d
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
| CRM | Pipeline, contacts, companies, deals, leads, forecasting, saved views, web-to-lead forms |
| HRM | Employees, departments, org chart (React Flow), leave management, attendance |
| Calendar | Month/week/day/year/agenda views with Google Calendar sync |
| Projects | Time tracking, invoicing, clients, reports, budgets |
| Sign | PDF e-signatures with templates, sequential signing, audit trail, reminders |
| Drive | File storage with versioning, sharing, comments, activity log, password-protected links |
| Tables | Spreadsheets with linked records, CSV import, row comments, multiple views |
| Tasks | Task management with calendar, dependencies, attachments, assignees, comments |
| Write | Rich text editor with cover images, comments, templates |
| Draw | Excalidraw-based canvas with PDF export, image insertion, presentation mode |
| Marketplace | One-click deploy of 10 Docker apps (Metabase, Mattermost, Vaultwarden, etc.) |

## Marketplace

Atlas can also host 3rd party apps. Here is a screenshot of the Atlas Marketplace. We're adding more by time but feel free to create an issue if you would like to see your favorite app here.

<img width="2466" height="2210" alt="image" src="https://github.com/user-attachments/assets/45d83b6b-6554-4369-a7ac-306ab05118ba" />

| App | Category | Description | Status | License |
|-----|----------|-------------|--------|---------|
| Activepieces | Automation | Visual workflow automation — connect your apps and automate tasks |
| Cal.com | Scheduling | Open-source scheduling platform — event types, availability, booking pages, and calendar integrations |
| Chatwoot | Support | Open-source helpdesk and live chat — manage customer conversations across channels |
| Checkmate | Monitoring | Open-source uptime monitoring for your websites and APIs | 
| Formbricks | Forms | Open-source survey & experience management — in-app surveys, link surveys, and user research |
| Listmonk | Email Marketing | High-performance newsletter and mailing list manager — self-hosted email marketing |
| Mattermost | Communication | Open-source team messaging — channels, threads, and integrations (Slack alternative) |
| Metabase | Analytics | Business intelligence and analytics dashboards — ask questions, get charts |
| Umami | Analytics | Privacy-focused web analytics — lightweight alternative to Google Analytics | 
| Vaultwarden | Security | Bitwarden-compatible password manager — self-hosted vault for keys and secrets | 


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
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth (CRM sync, Drive import/export) |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth secret |
| `SMTP_HOST` | No | — | SMTP server for password reset emails |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |

## Google integration (optional)

Enables CRM email/calendar sync and Drive file import/export.

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services > Credentials**
2. Create an **OAuth 2.0 Client ID** (type: Web application)
3. Set the authorized redirect URI to: `https://your-domain.com/api/v1/auth/google/callback`
4. Copy the Client ID and Client Secret into your `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```
5. Enable these APIs in **APIs & Services > Library**:
   - Gmail API
   - Google Calendar API
   - Google Drive API
6. Users can connect their Google account from **Settings** or when using Google-dependent features

## Troubleshooting

**"network ... not found" error**

```bash
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

**Port 3001 already in use**

Stop the process using port 3001, or set a different port in `.env`:
```
PORT=3002
```

**Update to latest version**

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

**Reset everything (fresh start)**

```bash
docker compose -f docker-compose.production.yml down -v
docker compose -f docker-compose.production.yml up -d
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
