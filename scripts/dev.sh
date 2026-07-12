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

docker compose up postgres -d --wait

# packages/db reads DATABASE_URL from process.env directly (no dotenv loading),
# so it must be exported into the shell before running the migrate script.
set -a
source .env
set +a

pnpm --filter @lessonbuild/db migrate

exec pnpm dev
