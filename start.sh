#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load nvm so we can use Node in non-interactive shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Kill stale processes on target ports
for port in 8000 5173; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        echo "[Setup] Killing stale process on port $port (PID $pid)..."
        kill $pid 2>/dev/null || true
        sleep 1
    fi
done

# Install frontend deps if needed
if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo "[Setup] Installing frontend dependencies..."
    cd "$ROOT_DIR/frontend"
    nvm use v22 > /dev/null 2>&1
    npm install
fi

cleanup() {
    echo ""
    echo "Stopping all services..."
    for pid in $BACKEND_PID $FRONTEND_PID; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null
    done
    wait 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

echo "=== Starting Pivot ==="

# Backend
echo "[Backend] Starting FastAPI on :8000 ..."
cd "$ROOT_DIR/backend"
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Frontend
echo "[Frontend] Starting Vite dev server on :5173 ..."
cd "$ROOT_DIR/frontend"
nvm use v22 > /dev/null 2>&1
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=== All services running ==="
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."

wait
