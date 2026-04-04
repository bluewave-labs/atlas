# Marketplace app research — Self-hosted Docker apps for SMBs

> Research date: April 2026
> Existing marketplace apps: Checkmate (uptime), Umami (analytics), Metabase (BI), Activepieces (automation)

---

## 1. Forms/Surveys

### Heyform
- **Description:** Open-source form builder with conversational UI, similar to Typeform.
- **Docker image:** `heyform/community-edition`
- **Internal port:** 9513
- **Health check:** `GET /` (HTTP 200)
- **Required services:** MongoDB (bundled or external)
- **License:** AGPL-3.0
- **RAM estimate:** ~256 MB
- **Website:** https://heyform.net

### Formbricks
- **Description:** Open-source survey and experience management platform (Typeform + Hotjar alternative).
- **Docker image:** `formbricks/formbricks`
- **Internal port:** 3000
- **Health check:** `GET /api/health` (HTTP 200)
- **Required services:** PostgreSQL
- **License:** AGPL-3.0 (with some MIT modules)
- **RAM estimate:** ~256 MB
- **Website:** https://formbricks.com

---

## 2. Social media scheduling

### Mixpost
- **Description:** Self-hosted social media management and scheduling tool (Buffer alternative).
- **Docker image:** `inovector/mixpost`
- **Internal port:** 80
- **Health check:** `GET /` (HTTP 200)
- **Required services:** MySQL/MariaDB, Redis
- **License:** MIT
- **RAM estimate:** ~256 MB
- **Website:** https://mixpost.app

---

## 3. Helpdesk/Support

### Chatwoot
- **Description:** Omnichannel customer support platform with live chat, email, social, and API channels.
- **Docker image:** `chatwoot/chatwoot`
- **Internal port:** 3000
- **Health check:** `GET /auth/sign_in` (HTTP 200)
- **Required services:** PostgreSQL, Redis, Sidekiq (bundled)
- **License:** MIT
- **RAM estimate:** ~512 MB
- **Website:** https://www.chatwoot.com

### Peppermint
- **Description:** Lightweight open-source helpdesk/ticket management system.
- **Docker image:** `pepperlabs/peppermint`
- **Internal port:** 3000
- **Health check:** `GET /` (HTTP 200)
- **Required services:** PostgreSQL (or SQLite)
- **License:** AGPL-3.0
- **RAM estimate:** ~128 MB
- **Website:** https://peppermint.sh

---

## 4. Chat/Communication

### Rocket.Chat
- **Description:** Full-featured team chat platform with channels, DMs, video calls, and integrations.
- **Docker image:** `rocket.chat` (official Docker Hub)
- **Internal port:** 3000
- **Health check:** `GET /api/v1/info` (HTTP 200)
- **Required services:** MongoDB
- **License:** MIT
- **RAM estimate:** ~512 MB
- **Website:** https://rocket.chat

### Mattermost
- **Description:** Slack alternative for team messaging with channels, threads, and integrations.
- **Docker image:** `mattermost/mattermost-team-edition`
- **Internal port:** 8065
- **Health check:** `GET /api/v4/system/ping` (HTTP 200)
- **Required services:** PostgreSQL
- **License:** MIT (Team Edition) / AGPL-3.0 (Enterprise)
- **RAM estimate:** ~256–512 MB
- **Website:** https://mattermost.com

---

## 5. CMS/Website builder

### Ghost
- **Description:** Professional publishing platform and CMS for blogs, newsletters, and membership sites.
- **Docker image:** `ghost` (official Docker Hub)
- **Internal port:** 2368
- **Health check:** `GET /ghost/api/v4/admin/site/` (HTTP 200)
- **Required services:** MySQL (built-in SQLite for simple setups)
- **License:** MIT
- **RAM estimate:** ~256 MB
- **Website:** https://ghost.org

### WordPress
- **Description:** The world's most popular CMS — extensible website and blog builder.
- **Docker image:** `wordpress` (official Docker Hub)
- **Internal port:** 80
- **Health check:** `GET /wp-login.php` (HTTP 200)
- **Required services:** MySQL/MariaDB
- **License:** GPL-2.0
- **RAM estimate:** ~256 MB
- **Website:** https://wordpress.org

---

## 6. Password manager

### Vaultwarden
- **Description:** Lightweight Bitwarden-compatible server for team password management.
- **Docker image:** `vaultwarden/server`
- **Internal port:** 80
- **Health check:** `GET /alive` (HTTP 200)
- **Required services:** None (uses SQLite by default; optional PostgreSQL/MySQL)
- **License:** AGPL-3.0
- **RAM estimate:** ~64 MB
- **Website:** https://github.com/dani-garcia/vaultwarden

---

## 7. Bookkeeping/Invoicing

### Invoice Ninja
- **Description:** Full-featured invoicing, billing, and payment platform for freelancers and small businesses.
- **Docker image:** `invoiceninja/invoiceninja`
- **Internal port:** 80
- **Health check:** `GET /` (HTTP 200)
- **Required services:** MySQL/MariaDB
- **License:** AAL (Elastic License 2.0 for v5, previously MIT)
- **RAM estimate:** ~256 MB
- **Website:** https://invoiceninja.com

### Crater
- **Description:** Open-source invoicing and expense tracking application for small businesses.
- **Docker image:** `craterapp/crater` (community Docker images available)
- **Internal port:** 80
- **Health check:** `GET /` (HTTP 200)
- **Required services:** MySQL/MariaDB
- **License:** AAL-1.0
- **RAM estimate:** ~256 MB
- **Website:** https://craterapp.com

---

## 8. Email marketing

### Listmonk
- **Description:** High-performance, self-hosted newsletter and mailing list manager.
- **Docker image:** `listmonk/listmonk`
- **Internal port:** 9000
- **Health check:** `GET /api/health` (HTTP 200)
- **Required services:** PostgreSQL
- **License:** AGPL-3.0
- **RAM estimate:** ~64 MB
- **Website:** https://listmonk.app

### Mautic
- **Description:** Open-source marketing automation platform with email campaigns, lead scoring, and landing pages.
- **Docker image:** `mautic/mautic`
- **Internal port:** 80
- **Health check:** `GET /` (HTTP 200)
- **Required services:** MySQL/MariaDB, (optional Redis)
- **License:** GPL-3.0
- **RAM estimate:** ~512 MB
- **Website:** https://www.mautic.org

---

## 9. Wiki/Knowledge base

### BookStack
- **Description:** Simple, self-hosted wiki platform organized by shelves, books, chapters, and pages.
- **Docker image:** `lscr.io/linuxserver/bookstack` or `solidnerd/bookstack`
- **Internal port:** 80 (linuxserver) / 8080
- **Health check:** `GET /login` (HTTP 200)
- **Required services:** MySQL/MariaDB
- **License:** MIT
- **RAM estimate:** ~128 MB
- **Website:** https://www.bookstackapp.com

### Outline
- **Description:** Beautiful wiki and knowledge base for teams with real-time collaboration and Markdown support.
- **Docker image:** `outlinewiki/outline`
- **Internal port:** 3000
- **Health check:** `GET /api/auth.config` (HTTP 200)
- **Required services:** PostgreSQL, Redis, S3 (MinIO)
- **License:** BSL 1.1 (converts to Apache-2.0 after 3 years)
- **RAM estimate:** ~256 MB
- **Website:** https://www.getoutline.com

---

## 10. Other useful SMB tools

### Cal.com
- **Description:** Open-source scheduling and appointment booking platform (Calendly alternative).
- **Docker image:** `calcom/cal.com`
- **Internal port:** 3000
- **Health check:** `GET /api/health` (HTTP 200)
- **Required services:** PostgreSQL, (optional Redis)
- **License:** AGPL-3.0
- **RAM estimate:** ~256 MB
- **Website:** https://cal.com

### Plane
- **Description:** Open-source project management tool (Jira/Linear alternative) with issues, cycles, and modules.
- **Docker image:** `makeplane/plane-frontend` + `makeplane/plane-backend` + `makeplane/plane-worker`
- **Internal port:** 3000 (frontend), 8000 (backend)
- **Health check:** `GET /` (HTTP 200)
- **Required services:** PostgreSQL, Redis, MinIO
- **License:** AGPL-3.0
- **RAM estimate:** ~512 MB (combined)
- **Website:** https://plane.so

### Documenso
- **Description:** Open-source document signing platform (DocuSign alternative).
- **Docker image:** `documenso/documenso`
- **Internal port:** 3000
- **Health check:** `GET /api/health` (HTTP 200)
- **Required services:** PostgreSQL
- **License:** AGPL-3.0
- **RAM estimate:** ~256 MB
- **Website:** https://documenso.com

### Twenty CRM
- **Description:** Modern open-source CRM inspired by Notion, with a clean UI and GraphQL API.
- **Docker image:** `twentycrm/twenty`
- **Internal port:** 3000
- **Health check:** `GET /api/healthz` (HTTP 200)
- **Required services:** PostgreSQL, Redis
- **License:** AGPL-3.0
- **RAM estimate:** ~512 MB
- **Website:** https://twenty.com

### Rallly
- **Description:** Simple scheduling poll tool for finding the best meeting time (Doodle alternative).
- **Docker image:** `lukevella/rallly`
- **Internal port:** 3000
- **Health check:** `GET /api/health` (HTTP 200)
- **Required services:** PostgreSQL
- **License:** AGPL-3.0
- **RAM estimate:** ~128 MB
- **Website:** https://rallly.co

### n8n
- **Description:** Workflow automation tool with visual editor and 400+ integrations (Zapier alternative).
- **Docker image:** `n8nio/n8n`
- **Internal port:** 5678
- **Health check:** `GET /healthz` (HTTP 200)
- **Required services:** None (SQLite default; optional PostgreSQL)
- **License:** Sustainable Use License (fair-code)
- **RAM estimate:** ~256 MB
- **Website:** https://n8n.io

### Plausible Analytics
- **Description:** Privacy-friendly, lightweight web analytics (Google Analytics alternative).
- **Docker image:** `ghcr.io/plausible/community-edition`
- **Internal port:** 8000
- **Health check:** `GET /api/health` (HTTP 200)
- **Required services:** PostgreSQL, ClickHouse
- **License:** AGPL-3.0
- **RAM estimate:** ~256 MB (+ ClickHouse ~512 MB)
- **Website:** https://plausible.io

---

## Top Picks — Recommended first batch

These are the strongest candidates based on Docker simplicity, community size, active maintenance, and value to SMBs:

| Priority | App | Category | Why |
|----------|-----|----------|-----|
| 1 | **Listmonk** | Email marketing | Incredibly lightweight (64 MB), just needs PostgreSQL, dead-simple Docker setup |
| 2 | **Vaultwarden** | Password manager | Just 64 MB RAM, no deps, every team needs this |
| 3 | **BookStack** | Wiki/Knowledge base | MIT license, minimal resources, great UX |
| 4 | **Chatwoot** | Helpdesk/Support | Feature-rich, MIT license, widely adopted |
| 5 | **Formbricks** | Forms/Surveys | Modern UI, PostgreSQL (shared), active development |
| 6 | **Cal.com** | Scheduling | Every business needs appointment booking |
| 7 | **Ghost** | CMS/Blog | Gold standard for publishing, MIT license |
| 8 | **Mattermost** | Team chat | Proven Slack alternative, PostgreSQL-based |
| 9 | **Mixpost** | Social scheduling | Only real self-hosted Buffer alternative, MIT |
| 10 | **Invoice Ninja** | Invoicing | Full billing suite, very popular |

### Resource planning note

For a single server running the existing 4 marketplace apps plus 5-6 new ones, budget at least:
- **CPU:** 4 vCPUs
- **RAM:** 8 GB minimum, 16 GB recommended
- **Disk:** 100 GB SSD
- **Database strategy:** Share a single PostgreSQL instance across apps that support it (Listmonk, Formbricks, Chatwoot, Mattermost, Cal.com, BookStack via MySQL) to reduce overhead. Use separate databases within the same PostgreSQL server.
