# syntax=docker/dockerfile:1

# Multi-stage build producing ONE image that can run either process:
#   web    →  npm start        (next start)
#   worker →  npm run worker    (tsx src/workers/agentRunWorker.ts)
# tsx is a runtime dependency so the worker runs from source without a separate
# TypeScript build. Database migrations are NOT baked in — run
# `npx prisma migrate deploy` as a documented release step (see docs/deployment.md).

# ─── deps: install all dependencies (incl. dev) for the build ────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── builder: generate Prisma client, build Next, prune to prod deps ─────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-only placeholders passed inline (never stored in an image layer) so
# `next build` never needs a real DB or secret.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    AUTH_SECRET="build-only-not-a-real-secret" \
    npm run build
# Drop devDependencies; the generated Prisma client (@prisma/client) and tsx are
# production deps and remain.
RUN npm prune --omit=dev

# ─── runner: minimal runtime image, non-root ─────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# App artifacts and the pruned production node_modules. (No public/ dir in this
# project; next start serves fine without one.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
# Worker source (executed via tsx) + shared library code it imports.
COPY --from=builder /app/src ./src

USER nextjs

EXPOSE 3000
ENV PORT=3000

# Default to the web process; the worker service overrides the command.
CMD ["npm", "start"]
