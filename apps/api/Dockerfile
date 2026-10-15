# Multi-stage build. Final image runs as a non-root user with no build toolchain.
FROM node:20.18-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @ck/types run build && pnpm --filter @ck/api run build
RUN pnpm --filter @ck/api --prod deploy /out

FROM node:20.18-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs api
WORKDIR /app
COPY --from=build --chown=api:nodejs /out/node_modules ./node_modules
COPY --from=build --chown=api:nodejs /repo/apps/api/dist ./dist
COPY --from=build --chown=api:nodejs /repo/apps/api/package.json ./package.json
USER api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
