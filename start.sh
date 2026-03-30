#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/api/.env"

echo "Starting openclaw client..."

if [ ! -f "$ENV_FILE" ]; then
  if command -v openssl >/dev/null 2>&1; then
      JWT_SECRET="$(openssl rand -hex 32)"
      MONGO_PASSWORD="$(openssl rand -hex 16)"
    else
      JWT_SECRET="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)"
      MONGO_PASSWORD="$(LC_ALL=C tr -dc 'a-f0-9' </dev/urandom | head -c 32)"
    fi
cat > "$ENV_FILE" << EOF  
MONGO_USER="openclaw"
NODE_ENV=development
JWT_SECRET=${JWT_SECRET}
MONGO_LINK=mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/openClawClient?authSource=admin
EOF
  echo "Created ${ENV_FILE}"
else
  echo "${ENV_FILE} already exists; not overwriting."
fi

echo ""
echo "Installing proxy dependencies..."
cd "$ROOT/proxy" && npm install

echo ""
echo "Starting Docker services..."
cd "$ROOT"
docker compose up -d

echo ""
echo "Starting OpenClaw proxy on host (port 18801)..."
cd "$ROOT/proxy"
nohup node proxy.js > "$ROOT/proxy/proxy.log" 2>&1 &
PROXY_PID=$!
echo "Proxy started (PID: $PROXY_PID), log: proxy/proxy.log"
echo ""
echo "All services are up!"
echo "  Client:  http://localhost:18800"
echo "  API:     http://localhost:18802"
echo "  Proxy:   http://localhost:18801 (host, runs openclaw CLI)"
