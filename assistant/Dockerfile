# Atomic CRM assistant service (BYOK, pi-durable)
FROM node:24-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Runtime data (pi-durable SQLite) lives in /data; mount a volume.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    ASSISTANT_SQLITE_PATH=/data/assistant.sqlite

VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/assistant/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "src/index.ts"]
