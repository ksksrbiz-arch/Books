# syntax=docker/dockerfile:1.7
# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install deps first (cached unless package*.json changes)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source and build
COPY . .
ENV NODE_ENV=production
RUN npm run build && npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Create unprivileged user
RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app \
    && mkdir -p /app/generated-images && chown -R app:app /app

# Copy only what's needed to run
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/firebase-applet-config.json ./firebase-applet-config.json

USER app
EXPOSE 3000
# Container health probe (Cloud Run also calls /readyz at the platform level)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
