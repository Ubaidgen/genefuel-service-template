# syntax=docker/dockerfile:1.7
# Multi-stage: build with dev deps, ship only dist + production deps, run as non-root.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# tini forwards SIGTERM so Nest shutdown hooks close the DB pool and Redis cleanly.
ENTRYPOINT ["/sbin/tini", "--"]
# Migrations run as a separate release step: docker run <image> node dist/core/db/migrate.js
CMD ["node", "dist/main.js"]
