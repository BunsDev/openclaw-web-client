#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Stopping openclaw client..."

echo "Stopping Docker services..."
cd "$ROOT"
docker compose down

echo "Stopping OpenClaw proxy..."
pkill -f "node proxy.js" 2>/dev/null && echo "Proxy stopped." || echo "Proxy was not running."

echo ""
echo "All services stopped."
