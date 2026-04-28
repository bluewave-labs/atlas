<p align="center">
   <img width="350" height="330" alt="image" src="https://github.com/user-attachments/assets/a9c1bd4b-1538-4378-81bd-a883175ac309" />
</p>


A self-hosted business platform that brings CRM, HRM, invoicing, agreements, documents, projects & tasks, file storage, and whiteboards into one connected workspace for your team. An open alternative to [Zoho](https://zoho.com/) and [Odoo](https://www.odoo.com/).

**Live demo:** [app.dodoapps.net](https://app.dodoapps.net) · **Docker image:** [`ghcr.io/gorkem-bwl/atlas`](https://github.com/gorkem-bwl/atlas/pkgs/container/atlas) (multi-arch amd64 + arm64) · **Releases:** [github.com/gorkem-bwl/atlas/releases](https://github.com/gorkem-bwl/atlas/releases)



https://github.com/user-attachments/assets/8baaa7d3-4d8e-45ba-b769-73b3feabd58a




## Quick start (Docker)

**macOS / Linux:**
```bash
git clone https://github.com/gorkem-bwl/atlas.git
cd atlas
chmod +x setup.sh
./setup.sh
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/gorkem-bwl/atlas.git
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
git clone https://github.com/gorkem-bwl/atlas.git
cd atlas
docker compose -f docker-compose.production.yml up -d
```

Open **http://localhost:3001** and create your admin account. Secrets are auto-generated on first run.

To pin a specific version: `IMAGE_TAG=<version> docker compose -f docker-compose.production.yml up -d` — see the [latest release](https://github.com/gorkem-bwl/atlas/releases/latest) for the current tag.

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
npm install

# 3. Create environment file
cp .env.example .env

# 4. Update .env for local development:
#    - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas
#    - CLIENT_PUBLIC_URL=http://localhost:5180
#    - CORS_ORIGINS=http://localhost:5180,http://localhost:3001
#    The JWT secrets in .env.example are placeholders — generate real ones:
#      openssl rand -hex 32  → paste into JWT_SECRET
#      openssl rand -hex 32  → paste into JWT_REFRESH_SECRET
#      openssl rand -hex 32  → paste into TOKEN_ENCRYPTION_KEY

# 5. Start dev servers
npm run dev
```

- Client: http://localhost:5180
- Server: http://localhost:3001
- On first visit, you'll be prompted to create an admin account.

## API documentation

Atlas exposes an OpenAPI 3.1 specification and an interactive reference UI:

- **Raw spec:** `http://localhost:3001/api/v1/openapi.json`
- **Interactive reference** (Scalar): `http://localhost:3001/api/v1/reference`

The spec is generated from Zod schemas in `packages/server/src/openapi/paths/`. When a route adopts `defineRoute()`, the same schema drives both the OpenAPI registration and runtime request validation — so documentation and wire contract cannot drift.

On a self-hosted deployment, replace `localhost:3001` with your Atlas domain.

## Apps

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/crm.png" alt="CRM" /><br/>
      <b>CRM</b> — Pipeline, contacts, companies, deals, leads, forecasting, saved views, web-to-lead forms
    </td>
    <td width="50%">
      <img src="docs/screenshots/hr.png" alt="HR" /><br/>
      <b>HRM</b> — Employees, departments, org chart, leave management, attendance
    </td>
  </tr>
  <tr>
    <td>
      <img src="docs/screenshots/projects.png" alt="Work" /><br/>
      <b>Work</b> — Projects, tasks, time tracking, billing, reports, budgets
    </td>
    <td>
      <img src="docs/screenshots/calendar.png" alt="Calendar" /><br/>
      <b>Calendar</b> — Month/week/day/year/agenda views with Google Calendar sync
    </td>
  </tr>
  <tr>
    <td>
      <img src="docs/screenshots/invoices.png" alt="Invoices" /><br/>
      <b>Invoices</b> — Invoice creation, recurring billing, templates, payment tracking
    </td>
    <td>
      <img src="docs/screenshots/sign.png" alt="Agreements" /><br/>
      <b>Agreements</b> — PDF contracts with e-signatures, templates, counterparty linking, sequential signing, audit trail, reminders
    </td>
  </tr>
  <tr>
    <td>
      <img src="docs/screenshots/drive.png" alt="Drive" /><br/>
      <b>Drive</b> — File storage with versioning, sharing, comments, activity log, password-protected links
    </td>
    <td>
      <img src="docs/screenshots/write.png" alt="Write" /><br/>
      <b>Write</b> — Rich text editor with cover images, comments, templates
    </td>
  </tr>
  <tr>
    <td>
      <img src="docs/screenshots/system.png" alt="System" /><br/>
      <b>System</b> — CPU/memory/disk monitoring, email settings, role-based app permissions
    </td>
  </tr>
</table>

Atlas also includes **Draw** — an Excalidraw-based canvas with PDF export, image insertion, and presentation mode.

**Data import.** Bring your CRM data with you. Atlas ships with an Odoo importer (Settings → Data import) that ingests `res.partner`, `crm.lead`, and CRM activity CSV exports — mapping companies, contacts, leads, deals, and activities into your tenant in one pass, with per-row validation and a skipped-row report. HubSpot is on the way.


## Tech stack

- **Frontend**: React, TypeScript, Vite, TanStack Query, Zustand
- **Backend**: Express, TypeScript, Drizzle ORM, PostgreSQL
- **Infrastructure**: Docker, Redis, BullMQ

## Environment variables

Atlas boots with a small set of **required** secrets. Everything else is optional and only enables specific features — see the *What needs what* table below.

### Required (Atlas will not start without these)

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing key. Min 32 chars. Generate: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Refresh-token signing key. Min 32 chars. Generate: `openssl rand -hex 32` |
| `TOKEN_ENCRYPTION_KEY` | 64-char hex string used to encrypt Google OAuth tokens at rest. Generate: `openssl rand -hex 32` |

> The Docker `setup.sh` / `setup.ps1` scripts generate all three for you on first run. If you use `docker-compose.production.yml` directly, the compose file auto-generates them as well. You only need to set them manually when running Atlas outside Docker (e.g. development, or a custom deploy).

### Networking & database (defaults work for most setups)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/atlas` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | `atlas` | Postgres password when using the bundled Docker compose |
| `REDIS_URL` | *(unset)* | Redis connection. Required **only** for the Google sync background worker; everything else runs without Redis. |
| `PORT` | `3001` | Server port |
| `SERVER_PUBLIC_URL` | `http://localhost:3001` | Publicly reachable URL of the Atlas API (used in invitation / password-reset links, and as the default OAuth redirect host) |
| `CLIENT_PUBLIC_URL` | `http://localhost:5180` in dev, same as `SERVER_PUBLIC_URL` in production | Publicly reachable URL of the Atlas web app |
| `CORS_ORIGINS` | *(derived from `CLIENT_PUBLIC_URL`)* | Comma-separated origins allowed to call the API |
| `DISABLE_PUBLIC_SIGNUP` | `true` | Public self-registration is **off by default** on every self-hosted instance. The first-run setup flow and tenant invitations always work. Set `DISABLE_PUBLIC_SIGNUP=false` only if you're running Atlas as an open SaaS where anyone can create their own workspace. |

### Optional integrations

| Variable | Default | Needed for |
|----------|---------|-----------|
| `SMTP_HOST` | — | Outgoing email (see [SMTP setup](#smtp-setup-optional)) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP auth user |
| `SMTP_PASS` | — | SMTP auth password |
| `SMTP_FROM` | `Atlas <noreply@atlas.so>` | From-address used on outgoing mail. Change this to match your domain. |
| `GOOGLE_CLIENT_ID` | — | Google OAuth (Calendar / Gmail / Drive per-user sync — see [Google integration](#google-integration-optional)) |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth secret |
| `GOOGLE_REDIRECT_URI` | `{SERVER_PUBLIC_URL}/api/v1/auth/google/callback` | Override the OAuth redirect URL if the server sits behind a proxy with a different hostname |

### What needs what

Atlas is designed so you only pay for the integrations you want. If you skip the optional variables above, the affected features silently become unavailable — the rest of the app keeps working.

| Feature | Requires |
|---------|----------|
| CRM, HRM, Work (projects + tasks), Invoices, Agreements, Drive (Atlas-native), Write, Draw, Calendar (local events) | **Nothing extra.** Runs on Postgres alone. |
| Password-reset emails | SMTP |
| Team-member invitation emails | SMTP |
| Sign / agreement reminder emails | SMTP |
| CRM outbound email to contacts | SMTP (+ Google for per-user Gmail tracking) |
| Calendar sync with Google Calendar | Google OAuth (per user) |
| Gmail read/send inside CRM | Google OAuth (per user) |
| Google Drive file import/export inside Drive app | Google OAuth (per user) |
| Background Google sync worker (non-blocking) | Redis + Google OAuth |

If you plan to run Atlas as a closed team tool with no email needs, you can skip SMTP and Google entirely. Users just won't receive emails (invitations have to be shared as links manually) and `/calendar`, `/crm`, `/drive` will work locally without Google sync.

## SMTP setup (optional)

Atlas **sends** email (it never receives). SMTP is used for:

- Password reset links
- Team-member invitations (`POST /auth/invitation`)
- Agreement reminders (hourly scheduler, Sign app)
- CRM outbound messages from the CRM email composer
- The "Send test email" button in **Settings → System**

If `SMTP_HOST` is not set, all of the above are logged and skipped — no errors, features that depend on them just can't deliver.

### Common providers

```env
# Gmail (requires an App Password, not your regular password — enable 2FA first)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourdomain.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=Atlas <you@yourdomain.com>

# SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-api-key
SMTP_FROM=Atlas <noreply@yourdomain.com>

# Resend
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_your-api-key
SMTP_FROM=Atlas <noreply@yourdomain.com>

# Postmark
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<server-token>
SMTP_PASS=<server-token>
SMTP_FROM=Atlas <noreply@yourdomain.com>
```

After editing `.env`, restart Atlas and click **Settings → System → Send test email** to verify delivery.

## Google integration (optional)

Atlas uses Google OAuth on a **per-user** basis. Each user clicks *Connect Google* in their own **Settings** to grant access — the admin only has to provide the OAuth client ID/secret once. Without Google set up, `/calendar` still works (events live in Postgres), CRM email features are hidden, and Drive works for Atlas-native files only.

### 1. Create an OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com) and create or select a project.
2. **APIs & Services → Library** — enable:
   - Gmail API
   - Google Calendar API
   - Google Drive API
3. **APIs & Services → OAuth consent screen** — configure:
   - User type: *External* (unless you're on Google Workspace, in which case *Internal* is simpler).
   - App name, support email, developer contact.
   - While in *Testing* status you can only authenticate accounts listed under **Test users**. For a single-company deployment that's often enough. If you want anyone in your org (or the public) to be able to connect, click **Publish app** — note that the sensitive scopes (`gmail.readonly`, `gmail.send`) require [Google verification](https://support.google.com/cloud/answer/9110914) before the app leaves *In production* warning state.
4. **APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID**:
   - Application type: *Web application*.
   - Authorized redirect URI: `https://your-atlas-domain/api/v1/auth/google/callback` (use `http://localhost:3001/api/v1/auth/google/callback` for local dev).

### 2. Add to `.env`

```env
GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxx
# Optional — only needed if the server's public URL differs from the OAuth redirect host
# GOOGLE_REDIRECT_URI=https://your-atlas-domain/api/v1/auth/google/callback
```

Restart Atlas. The **Connect Google** option appears in **Settings → Integrations** for each user.

### Scopes that Atlas requests

On the initial connection:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`

Drive scopes are requested incrementally only when the user first opens the Drive integration, so users who never touch Drive don't grant those:

- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/drive.file`

Tokens are encrypted at rest with `TOKEN_ENCRYPTION_KEY` before being written to Postgres.

### Background sync (optional)

If `REDIS_URL` is also set, Atlas enables a BullMQ worker that keeps user Gmail/Calendar in sync outside the request path (periodic pull, webhook delivery). Without Redis, sync happens on-demand when users open the CRM or Calendar views — still functional, just not ambient.

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

[GNU Affero General Public License v3.0](LICENSE) — free to use, modify, and distribute. If you run a modified version as a network service, you must make the source available to users.
