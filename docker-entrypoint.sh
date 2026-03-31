#!/bin/sh
# Atlas Docker entrypoint — auto-detect public IP if URLs not explicitly set

# If CLIENT_PUBLIC_URL is still the default localhost, try to detect public IP
if [ "$CLIENT_PUBLIC_URL" = "http://localhost:3001" ] || [ -z "$CLIENT_PUBLIC_URL" ]; then
  PUBLIC_IP=$(wget -qO- http://ifconfig.me 2>/dev/null || wget -qO- http://api.ipify.org 2>/dev/null || echo "")
  if [ -n "$PUBLIC_IP" ]; then
    export CLIENT_PUBLIC_URL="http://${PUBLIC_IP}:${PORT:-3001}"
    export SERVER_PUBLIC_URL="http://${PUBLIC_IP}:${PORT:-3001}"
    export CORS_ORIGINS="http://${PUBLIC_IP}:${PORT:-3001},http://localhost:${PORT:-3001}"
    echo "Auto-detected public IP: ${PUBLIC_IP}"
    echo "CLIENT_PUBLIC_URL=${CLIENT_PUBLIC_URL}"
    echo "CORS_ORIGINS=${CORS_ORIGINS}"
  fi
fi

# Run the original command
exec "$@"
