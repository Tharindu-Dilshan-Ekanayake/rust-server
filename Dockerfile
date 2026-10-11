# Modern Guns game server, as Bloxity Legion runs it: one process serving HTTP
# and WebSockets on $PORT, /health for the probes, non-root, drains on SIGTERM.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=2567 \
    # A pod has 512 MB; keep the JS heap well inside it (Rapier's WASM memory sits outside).
    NODE_OPTIONS=--max-old-space-size=320

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src

# The stock image's unprivileged user.
USER node
EXPOSE 2567

# Exec form: node is PID 1 and gets SIGTERM directly (src/server.js drains on it).
CMD ["node", "src/server.js"]
