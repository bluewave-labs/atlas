#!/bin/bash
set -e

echo ""
echo "  Atlas — Setup"
echo "  ─────────────"
echo ""

# ─── Prerequisites ─────────────────────────────────────────────────

MISSING=""

if ! command -v openssl >/dev/null 2>&1; then
  MISSING="$MISSING  - openssl (for generating secrets)\n"
fi

if ! command -v docker >/dev/null 2>&1; then
  MISSING="$MISSING  - docker (for running containers)\n"
fi

if [ -n "$MISSING" ]; then
  echo "  Missing required tools:"
  echo ""
  printf "$MISSING"
  echo ""
  echo "  Please install them and try again."
  exit 1
fi

# Check docker compose (v2 plugin or standalone)
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "  Error: docker compose is required but not found."
  echo "  Install Docker Desktop or the docker-compose-plugin."
  exit 1
fi

# Check Docker daemon is running
if ! docker info >/dev/null 2>&1; then
  echo "  Error: Docker daemon is not running."
  echo "  Please start Docker Desktop and try again."
  exit 1
fi

# Check we're in the right directory
if [ ! -f "docker-compose.production.yml" ]; then
  echo "  Error: docker-compose.production.yml not found."
  echo "  Please run this script from the Atlas project root."
  exit 1
fi

if [ ! -f ".env.example" ]; then
  echo "  Error: .env.example not found."
  echo "  Please run this script from the Atlas project root."
  exit 1
fi

# Check port 3001 is available
if command -v lsof >/dev/null 2>&1; then
  if lsof -i :3001 >/dev/null 2>&1; then
    echo "  Warning: Port 3001 is already in use."
    echo "  Atlas needs this port. Stop the other process or change PORT in .env."
    echo ""
  fi
fi

# Detect health check tool
if command -v curl >/dev/null 2>&1; then
  HEALTH_CHECK="curl"
elif command -v wget >/dev/null 2>&1; then
  HEALTH_CHECK="wget"
else
  HEALTH_CHECK="none"
fi

echo "  Prerequisites: OK"
echo ""

# ─── Generate .env ─────────────────────────────────────────────────

if [ ! -f .env ]; then
  echo "  [1/3] Generating secrets..."
  cp .env.example .env

  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^JWT_SECRET=CHANGE_ME$/JWT_SECRET=$JWT_SECRET/" .env
    sed -i '' "s/^JWT_REFRESH_SECRET=CHANGE_ME$/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
    sed -i '' "s/^TOKEN_ENCRYPTION_KEY=CHANGE_ME$/TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY/" .env
  else
    sed -i "s/^JWT_SECRET=CHANGE_ME$/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/^JWT_REFRESH_SECRET=CHANGE_ME$/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
    sed -i "s/^TOKEN_ENCRYPTION_KEY=CHANGE_ME$/TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY/" .env
  fi

  chmod 600 .env
  unset JWT_SECRET JWT_REFRESH_SECRET TOKEN_ENCRYPTION_KEY
  echo "         Done. Secrets written to .env"
else
  echo "  [1/3] Using existing .env file"
fi

# ─── Build and start ───────────────────────────────────────────────

echo "  [2/3] Building and starting containers (first run may take a few minutes)..."
echo ""

if ! $COMPOSE -f docker-compose.production.yml up -d --build; then
  echo ""
  echo "  Error: Docker build failed."
  echo ""
  echo "  Check the full output above for details."
  echo "  Common fixes:"
  echo "    - Make sure Docker Desktop has enough memory (4GB+ recommended)"
  echo "    - Try again: $COMPOSE -f docker-compose.production.yml up -d --build"
  echo ""
  exit 1
fi

echo ""

# ─── Health check ──────────────────────────────────────────────────

echo "  [3/3] Waiting for Atlas to be ready..."
READY=false
for i in $(seq 1 60); do
  if [ "$HEALTH_CHECK" = "curl" ]; then
    if curl -sf http://localhost:3001/api/v1/health > /dev/null 2>&1; then
      READY=true
      break
    fi
  elif [ "$HEALTH_CHECK" = "wget" ]; then
    if wget -qO- http://localhost:3001/api/v1/health > /dev/null 2>&1; then
      READY=true
      break
    fi
  else
    sleep 30
    READY=true
    break
  fi
  printf "."
  sleep 2
done

echo ""
echo ""

if [ "$READY" = true ]; then
  echo "  Atlas is running!"
  echo ""
  echo "  Open http://localhost:3001 to get started."
  echo "  You'll create your admin account on first visit."
  echo ""
  echo "  Useful commands:"
  echo "    View logs:     $COMPOSE -f docker-compose.production.yml logs -f atlas"
  echo "    Stop:          $COMPOSE -f docker-compose.production.yml down"
  echo "    Restart:       $COMPOSE -f docker-compose.production.yml restart atlas"
  echo ""
else
  echo "  Atlas didn't respond in time."
  echo ""
  echo "  Check the logs:"
  echo "    $COMPOSE -f docker-compose.production.yml logs atlas"
  echo ""
  exit 1
fi
