#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Atlas — One-line installer
#
# Interactive usage (recommended):
#   bash <(curl -fsSL https://raw.githubusercontent.com/gorkem-bwl/atlas/main/install.sh)
#
# Unattended usage (set env vars):
#   ATLAS_DOMAIN=atlas.example.com ATLAS_EMAIL=admin@example.com \
#     bash <(curl -fsSL https://raw.githubusercontent.com/gorkem-bwl/atlas/main/install.sh)
#
# Supports: Ubuntu 20.04+, Debian 11+, CentOS 8+, Amazon Linux 2
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colors & symbols ─────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
ARROW="${BLUE}→${NC}"
WARN="${YELLOW}!${NC}"

# ── Helpers ──────────────────────────────────────────────────────────────────

info()    { echo -e "  ${ARROW} $1"; }
success() { echo -e "  ${CHECK} $1"; }
warn()    { echo -e "  ${WARN} $1"; }
fail()    { echo -e "  ${CROSS} $1"; exit 1; }

header() {
  echo ""
  echo -e "${BOLD}${CYAN}$1${NC}"
  echo -e "${DIM}$(printf '%.0s─' $(seq 1 60))${NC}"
}

generate_secret() {
  # Generate a cryptographically secure random hex string
  # Works on Linux (OpenSSL) and macOS
  openssl rand -hex 32 2>/dev/null || \
    head -c 32 /dev/urandom | xxd -p -c 64 2>/dev/null || \
    python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || \
    fail "Cannot generate secure random string. Install openssl and try again."
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

port_available() {
  local port=$1
  if command_exists ss; then
    ! ss -tlnp 2>/dev/null | grep -q ":${port} "
  elif command_exists netstat; then
    ! netstat -tlnp 2>/dev/null | grep -q ":${port} "
  elif command_exists lsof; then
    ! lsof -i ":${port}" >/dev/null 2>&1
  else
    # Cannot check — assume available
    return 0
  fi
}

# ── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}${CYAN}"
echo "    _   _   _           "
echo "   / \ | |_| | __ _ ___ "
echo "  / _ \| __| |/ _\` / __|"
echo " / ___ \ |_| | (_| \__ \\"
echo "/_/   \_\__|_|\__,_|___/"
echo -e "${NC}"
echo -e "${DIM}  Self-hosted business platform${NC}"
echo -e "${DIM}  https://github.com/gorkem-bwl/atlas${NC}"
echo ""

# ── Pre-flight checks ───────────────────────────────────────────────────────

header "Pre-flight checks"

# Must not be root (but needs sudo)
if [[ $EUID -eq 0 ]]; then
  warn "Running as root. This works but is not recommended for security."
fi

# Docker — auto-install if missing
if command_exists docker; then
  DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
  success "Docker installed (${DOCKER_VERSION})"
else
  info "Docker not found. Installing..."
  if command_exists apt-get; then
    # Ubuntu/Debian
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    success "Docker installed via apt"
  elif command_exists yum; then
    # CentOS/RHEL/Amazon Linux
    sudo yum install -y -q yum-utils
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
    success "Docker installed via yum"
  else
    fail "Cannot auto-install Docker on this system. Install manually: https://docs.docker.com/engine/install/"
  fi
  sudo systemctl start docker
  sudo systemctl enable docker
  # Add current user to docker group
  if [[ $EUID -ne 0 ]]; then
    sudo usermod -aG docker "$USER" 2>/dev/null || true
  fi
fi

# Docker daemon running
if docker info >/dev/null 2>&1; then
  success "Docker daemon is running"
elif sudo docker info >/dev/null 2>&1; then
  # Need sudo — user not in docker group yet
  warn "Docker requires sudo. Run 'newgrp docker' after install or re-login."
  alias docker='sudo docker'
  success "Docker daemon is running (via sudo)"
else
  fail "Docker daemon is not running. Start it with: sudo systemctl start docker"
fi

# Docker Compose
if docker compose version >/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
  success "Docker Compose installed (${COMPOSE_VERSION})"
elif command_exists docker-compose; then
  COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
  success "Docker Compose installed (${COMPOSE_VERSION})"
  docker() {
    if [[ "$1" == "compose" ]]; then
      shift
      command docker-compose "$@"
    else
      command docker "$@"
    fi
  }
else
  fail "Docker Compose is not installed. Install it: https://docs.docker.com/compose/install/"
fi

# RAM check (minimum 2 GB)
if [[ -f /proc/meminfo ]]; then
  TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
  if [[ $TOTAL_RAM_MB -ge 2048 ]]; then
    success "RAM: ${TOTAL_RAM_MB} MB (minimum 2048 MB)"
  else
    fail "Insufficient RAM: ${TOTAL_RAM_MB} MB. Atlas requires at least 2048 MB."
  fi
elif command_exists sysctl; then
  # macOS
  TOTAL_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
  TOTAL_RAM_MB=$((TOTAL_RAM_BYTES / 1024 / 1024))
  if [[ $TOTAL_RAM_MB -ge 2048 ]]; then
    success "RAM: ${TOTAL_RAM_MB} MB (minimum 2048 MB)"
  else
    fail "Insufficient RAM: ${TOTAL_RAM_MB} MB. Atlas requires at least 2048 MB."
  fi
else
  warn "Cannot detect RAM. Make sure you have at least 2 GB available."
fi

# Port checks
PORTS_OK=true
for PORT in 80 443; do
  if port_available "$PORT"; then
    success "Port ${PORT} is available"
  else
    warn "Port ${PORT} is already in use"
    PORTS_OK=false
  fi
done

if [[ "$PORTS_OK" == false ]]; then
  warn "Some ports are in use. This is fine if you are re-running the installer or have a proxy."
fi

# Port 3001 (Atlas app)
if port_available 3001; then
  success "Port 3001 is available"
else
  warn "Port 3001 is in use. Atlas may conflict with the existing service."
fi

# ── Installation directory ───────────────────────────────────────────────────

header "Setup"

INSTALL_DIR="${ATLAS_INSTALL_DIR:-$(pwd)/atlas}"

if [[ -f "${INSTALL_DIR}/docker-compose.production.yml" ]]; then
  info "Existing Atlas installation found at ${INSTALL_DIR}"
  info "Re-running configuration (existing data will be preserved)"
  IS_UPGRADE=true
else
  IS_UPGRADE=false
  mkdir -p "$INSTALL_DIR"
  success "Install directory: ${INSTALL_DIR}"
fi

cd "$INSTALL_DIR"

# Create data directories
mkdir -p atlas-data/backups
success "Data directory: ${INSTALL_DIR}/atlas-data"

# ── Interactive configuration ────────────────────────────────────────────────

header "Configuration"

# Detect if we have a TTY for interactive prompts
HAS_TTY=false
if [[ -t 0 ]]; then
  HAS_TTY=true
elif [[ -e /dev/tty ]]; then
  # Piped stdin but terminal available — redirect reads from /dev/tty
  exec 3</dev/tty 2>/dev/null && HAS_TTY=true || true
fi

# Read helper — works in both piped and TTY modes
prompt_read() {
  local var_name="$1"
  if [[ "$HAS_TTY" == true ]] && [[ -t 0 ]]; then
    read -r "$var_name"
  elif [[ "$HAS_TTY" == true ]]; then
    read -r "$var_name" <&3
  else
    # Non-interactive — use empty (caller provides default)
    eval "$var_name=''"
  fi
}

prompt_read_secret() {
  local var_name="$1"
  if [[ "$HAS_TTY" == true ]] && [[ -t 0 ]]; then
    read -rs "$var_name"
  elif [[ "$HAS_TTY" == true ]]; then
    read -rs "$var_name" <&3
  else
    eval "$var_name=''"
  fi
  echo ""
}

# Domain — from env or interactive
DOMAIN="${ATLAS_DOMAIN:-}"
if [[ -z "$DOMAIN" ]]; then
  if [[ "$HAS_TTY" == true ]]; then
    echo ""
    echo -e "  ${BOLD}Domain name${NC}"
    echo -e "  ${DIM}Enter your domain (e.g., atlas.example.com) or press Enter for localhost.${NC}"
    echo -e "  ${DIM}If using a domain, make sure DNS points to this server first.${NC}"
    echo -ne "  ${ARROW} Domain [${DIM}localhost${NC}]: "
    prompt_read DOMAIN
  fi
  DOMAIN="${DOMAIN:-localhost}"
fi
success "Domain: ${DOMAIN}"

# Admin email — from env or interactive
ADMIN_EMAIL="${ATLAS_EMAIL:-}"
if [[ -z "$ADMIN_EMAIL" ]]; then
  if [[ "$HAS_TTY" == true ]]; then
    echo ""
    echo -e "  ${BOLD}Admin email${NC}"
    echo -e "  ${DIM}Used for SSL certificates and as the initial admin account.${NC}"
    echo -ne "  ${ARROW} Email: "
    prompt_read ADMIN_EMAIL
    while [[ -z "$ADMIN_EMAIL" ]]; do
      echo -ne "  ${CROSS} Email is required: "
      prompt_read ADMIN_EMAIL
    done
  else
    fail "Admin email is required. Set ATLAS_EMAIL env var for unattended install.
  Example: ATLAS_EMAIL=admin@example.com bash <(curl -fsSL ...)"
  fi
fi
success "Admin email: ${ADMIN_EMAIL}"

# Database password — from env or auto-generate
DB_PASSWORD="${ATLAS_DB_PASSWORD:-}"
if [[ -z "$DB_PASSWORD" ]]; then
  if [[ "$HAS_TTY" == true ]]; then
    echo ""
    echo -e "  ${BOLD}Database password${NC}"
    echo -e "  ${DIM}Press Enter to auto-generate a secure password.${NC}"
    echo -ne "  ${ARROW} Password [${DIM}auto-generate${NC}]: "
    prompt_read_secret DB_PASSWORD
  fi
  if [[ -z "$DB_PASSWORD" ]]; then
    DB_PASSWORD=$(openssl rand -base64 24 2>/dev/null | tr -d '=/+' | head -c 24)
    success "Database password: auto-generated"
  else
    success "Database password: (user-provided)"
  fi
fi

# Generate secrets
info "Generating cryptographic secrets..."
JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)
TOKEN_ENCRYPTION_KEY=$(generate_secret)
success "JWT secrets generated"
success "Token encryption key generated"

# Determine URLs
if [[ "$DOMAIN" == "localhost" ]]; then
  PUBLIC_URL="http://localhost:3001"
  USE_HTTPS=false
else
  PUBLIC_URL="https://${DOMAIN}"
  USE_HTTPS=true
fi

# ── Generate .env file ───────────────────────────────────────────────────────

header "Generating configuration"

cat > .env <<EOF
# ─── Atlas Configuration ────────────────────────────────────────
# Generated by Atlas installer on $(date -u '+%Y-%m-%d %H:%M:%S UTC')

# Secrets (auto-generated — keep these safe!)
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}

# Database
POSTGRES_PASSWORD=${DB_PASSWORD}

# Public URLs
SERVER_PUBLIC_URL=${PUBLIC_URL}
CLIENT_PUBLIC_URL=${PUBLIC_URL}
CORS_ORIGINS=${PUBLIC_URL}

# Domain (for Caddy HTTPS)
ATLAS_DOMAIN=${DOMAIN}

# Admin
ATLAS_ADMIN_EMAIL=${ADMIN_EMAIL}

# Server port
PORT=3001
EOF

success "Configuration written to .env"

# ── Download Docker Compose files ────────────────────────────────────────────

header "Downloading Atlas"

REPO_BASE="https://raw.githubusercontent.com/gorkem-bwl/atlas/main"

download_file() {
  local url="$1"
  local dest="$2"
  if command_exists curl; then
    curl -fsSL "$url" -o "$dest"
  elif command_exists wget; then
    wget -qO "$dest" "$url"
  else
    fail "Neither curl nor wget found. Install one and try again."
  fi
}

for FILE in docker-compose.production.yml docker-compose.https.yml; do
  if [[ ! -f "$FILE" ]] || [[ "$IS_UPGRADE" == false ]]; then
    info "Downloading ${FILE}..."
    download_file "${REPO_BASE}/${FILE}" "$FILE" || fail "Failed to download ${FILE}"
    success "${FILE}"
  else
    success "${FILE} (existing)"
  fi
done

# Download atlas CLI tool
if [[ ! -f "atlas" ]]; then
  info "Downloading Atlas CLI..."
  download_file "${REPO_BASE}/atlas" "atlas" || warn "Could not download atlas CLI"
  chmod +x atlas 2>/dev/null
  success "Atlas CLI downloaded"
fi

# ── Pull images ──────────────────────────────────────────────────────────────

header "Pulling Atlas images"

info "Downloading from GitHub Container Registry..."
echo ""

docker compose -f docker-compose.production.yml pull 2>&1 | while IFS= read -r line; do
  echo -e "  ${DIM}${line}${NC}"
done

if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
  fail "Failed to pull Docker images. Check your network connection."
fi

success "Atlas image pulled (ghcr.io/gorkem-bwl/atlas:latest)"
info "Pulling PostgreSQL and Redis images..."
docker compose -f docker-compose.production.yml pull postgres redis 2>/dev/null
success "Database images ready"

if [[ "$USE_HTTPS" == true ]]; then
  info "Pulling Caddy image..."
  docker compose -f docker-compose.production.yml -f docker-compose.https.yml pull caddy 2>/dev/null
  success "Caddy image ready"
fi

# ── Start services ───────────────────────────────────────────────────────────

header "Starting Atlas"

info "Starting core services (PostgreSQL, Redis, Atlas)..."
docker compose -f docker-compose.production.yml up -d

success "Core services started"

# ── Health check ─────────────────────────────────────────────────────────────

header "Waiting for Atlas to become healthy"

MAX_WAIT=60
ELAPSED=0
HEALTH_URL="http://localhost:3001/api/v1/health"

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    success "Atlas is healthy!"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  echo -ne "\r  ${ARROW} Waiting... ${ELAPSED}s / ${MAX_WAIT}s"
done

echo ""

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  warn "Atlas did not become healthy within ${MAX_WAIT}s"
  warn "Check logs with: docker compose -f docker-compose.production.yml logs atlas"
  warn "It may still be starting up. Try: curl ${HEALTH_URL}"
fi

# ── Start Caddy for HTTPS ───────────────────────────────────────────────────

if [[ "$USE_HTTPS" == true ]]; then
  header "Starting HTTPS (Caddy)"

  info "Starting Caddy reverse proxy with automatic SSL..."
  docker compose -f docker-compose.production.yml -f docker-compose.https.yml up -d caddy
  success "Caddy started — SSL certificate will be obtained automatically"
fi

# ── Install CLI tool ─────────────────────────────────────────────────────────

header "Installing CLI"

if [[ -f "atlas" ]]; then
  chmod +x atlas
  if [[ -w /usr/local/bin ]]; then
    cp atlas /usr/local/bin/atlas
    success "Atlas CLI installed to /usr/local/bin/atlas"
  elif command_exists sudo && sudo -n true 2>/dev/null; then
    sudo cp atlas /usr/local/bin/atlas
    success "Atlas CLI installed to /usr/local/bin/atlas"
  else
    warn "Cannot write to /usr/local/bin. Install manually:"
    info "sudo cp ${INSTALL_DIR}/atlas /usr/local/bin/atlas"
  fi
else
  warn "Atlas CLI script not found. Download it from the repository."
fi

# ── Success message ──────────────────────────────────────────────────────────

echo ""
echo ""
echo -e "${BOLD}${GREEN}  ──────────────────────────────────────────${NC}"
echo -e "${BOLD}${GREEN}   Atlas is ready!${NC}"
echo -e "${BOLD}${GREEN}  ──────────────────────────────────────────${NC}"
echo ""

if [[ "$USE_HTTPS" == true ]]; then
  echo -e "  ${BOLD}URL:${NC}    https://${DOMAIN}"
else
  echo -e "  ${BOLD}URL:${NC}    http://localhost:3001"
fi

echo -e "  ${BOLD}Admin:${NC}  ${ADMIN_EMAIL}"
echo ""
echo -e "  ${DIM}Open the URL above to complete setup and create your admin account.${NC}"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    atlas status     — check service health"
echo -e "    atlas logs       — view logs"
echo -e "    atlas backup     — create a database backup"
echo -e "    atlas update     — update to the latest version"
echo ""
echo -e "  ${BOLD}Files:${NC}"
echo -e "    ${DIM}Config:${NC}    ${INSTALL_DIR}/.env"
echo -e "    ${DIM}Data:${NC}      ${INSTALL_DIR}/atlas-data/"
echo -e "    ${DIM}Backups:${NC}   ${INSTALL_DIR}/atlas-data/backups/"
echo ""
echo -e "  ${DIM}Documentation: https://github.com/gorkem-bwl/atlas${NC}"
echo ""
