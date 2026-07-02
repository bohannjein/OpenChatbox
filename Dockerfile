# syntax=docker/dockerfile:1
# Multi-stage build for OpenChatbox (Next.js 16 App Router — UI + BFF API routes
# live in the same server). Produces a small, non-root, standalone runtime image.

########################  deps  ########################
FROM node:22-alpine AS deps
# Next/SWC needs glibc-compat on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

########################  builder  ########################
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Emits .next/standalone (server + traced node_modules) and .next/static.
RUN npm run build

########################  runner  ########################
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Static assets + the standalone server bundle.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Persistent data (users.json, config.json). Mount a volume here in production.
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

# Lightweight healthcheck: the public setup-status endpoint returns JSON.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/setup >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
