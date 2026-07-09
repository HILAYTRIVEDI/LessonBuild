# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/agent/package.json apps/agent/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter agent...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/agent/node_modules ./apps/agent/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter agent build        # tsc / tsup → dist

FROM base AS prod-deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/agent/package.json apps/agent/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter agent...

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S agent -G nodejs
COPY --from=prod-deps --chown=agent:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=agent:nodejs /app/apps/agent/node_modules ./apps/agent/node_modules
COPY --from=build --chown=agent:nodejs /app/apps/agent/dist ./apps/agent/dist
COPY --from=build --chown=agent:nodejs /app/apps/agent/langgraph.json ./apps/agent/
# runMigrations() resolves the SQL file relative to its own __dirname, which
# after bundling into apps/agent/dist is one level up from packages/db/dist —
# mirror that relative layout here.
COPY --from=build --chown=agent:nodejs /app/packages/db/migrations ./apps/agent/migrations
USER agent
EXPOSE 2024
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:2024/ok || exit 1
CMD ["node", "apps/agent/dist/server.js"]
