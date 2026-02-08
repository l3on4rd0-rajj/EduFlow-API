# ---- deps/build stage ----
FROM node:20.20.0-trixie-slim AS builder
WORKDIR /app

# OpenSSL (corrige warning do Prisma)
RUN apt-get update -y \
 && apt-get install -y openssl \
 && rm -rf /var/lib/apt/lists/*

# Config do npm via ENV (evita travar no "npm config set")
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_PROGRESS=false

# Copia manifests e instala deps (usa lockfile)
COPY package*.json ./
RUN npm ci --verbose

# Copia o restante do código
COPY . .

# Prisma (se usar)
RUN npx prisma generate

# ---- runtime stage ----
FROM node:20.20.0-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL também no runtime (Prisma precisa em execução)
RUN apt-get update -y \
 && apt-get install -y openssl \
 && rm -rf /var/lib/apt/lists/*

# Copia app + deps do builder
COPY --from=builder /app /app

EXPOSE 3000
CMD ["node", "server.js"]
