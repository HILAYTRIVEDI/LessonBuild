#!/usr/bin/env bash
# Single-command non-Docker dev workflow: bring up Postgres, migrate, then run web+agent.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in AIMLAPI_KEY before continuing." >&2
  exit 1
fi

if [ ! -e apps/web/.env ]; then
  ln -s ../../.env apps/web/.env
fi

# langgraphjs (agent) and next (web) can leave orphaned listeners behind after
# a previous dev.sh was killed (e.g. Ctrl+C not reaping forked workers), which
# then blocks the next run with EADDRINUSE. Clear known dev ports first.
for port in 3000 2024; do
  pid=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Port $port in use by PID $pid from a previous run — killing it." >&2
    kill $pid 2>/dev/null || true
  fi
done

docker compose up postgres -d --wait

# packages/db reads DATABASE_URL from process.env directly (no dotenv loading),
# so it must be exported into the shell before running the migrate script.
set -a
source .env
set +a

pnpm --filter @lessonbuild/db migrate

exec pnpm dev
