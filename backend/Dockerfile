# Build stage: needs the full toolchain and the dev dependencies.
FROM node:20-alpine AS build

WORKDIR /app

# Copied on their own first, so a change to source code does not invalidate the
# cached dependency install.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build

# Runtime stage: production dependencies and compiled output only. No compiler,
# no test framework, no source.
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# node:alpine ships an unprivileged `node` user. Running as root inside a
# container is a needless risk when nothing here requires it.
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/server.js"]
