# syntax=docker/dockerfile:1
# Imagen de la API. Construir desde la raíz del monorepo:
#   docker build -f apps/server/Dockerfile -t ia-ajedrez-api .

FROM node:22-bookworm-slim AS build
WORKDIR /app
# Solo los manifiestos del servidor y del núcleo: así npm no instala las dependencias de la web
# (p. ej. Stockfish WASM, ~200 MB) aunque estén en el lockfile compartido.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN npm ci --workspace @ia-ajedrez/server --include-workspace-root=false --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/server apps/server
# El banco de puzzles (CC0) vive en la app web y se incluye en el bundle del servidor.
COPY apps/web/src/data/puzzles.json apps/web/src/data/puzzles.json
RUN npm run build --workspace @ia-ajedrez/server

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN npm ci --workspace @ia-ajedrez/server --include-workspace-root=false --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
# Stockfish nativo para el análisis en servidor (mucho más rápido que WASM). Licencia GPL-3.0.
RUN apt-get update \
  && apt-get install -y --no-install-recommends stockfish \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    STOCKFISH_PATH=/usr/games/stockfish
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
