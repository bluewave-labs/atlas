#!/bin/bash
# Generate an RSA private key for OIDC token signing.
# Output is a single-line env var ready to paste into .env

set -e

KEY=$(openssl genrsa 2048 2>/dev/null)
ESCAPED=$(echo "$KEY" | awk '{printf "%s\\n", $0}')

echo "OIDC_SIGNING_KEY=\"${ESCAPED}\""
