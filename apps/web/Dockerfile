# syntax=docker/dockerfile:1
# Imagen de la app web (estática con nginx). Construir desde la raíz del monorepo:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL= -t ia-ajedrez-web .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @ia-ajedrez/web --include-workspace-root=false --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/web apps/web
# Vacío = misma origen (nginx hace de proxy de /api y /ws). Para despliegues separados:
# --build-arg VITE_API_URL=https://api.example.com
ARG VITE_API_URL=""
ARG VITE_ANALYTICS_URL=""
ENV VITE_API_URL=$VITE_API_URL VITE_ANALYTICS_URL=$VITE_ANALYTICS_URL
RUN npm run build --workspace @ia-ajedrez/web

FROM nginx:1.27-alpine AS runtime
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
