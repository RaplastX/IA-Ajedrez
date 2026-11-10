# Despliegue

## Variables de entorno

Ver [`.env.example`](../.env.example). Mínimo en producción: `JWT_SECRET` (≥ 32 caracteres
aleatorios), `DATABASE_URL`, `CORS_ORIGINS` y `PUBLIC_WEB_URL`.

## Opción A — Todo en un servidor con Docker Compose

```bash
cp .env.example .env      # rellena JWT_SECRET (openssl rand -hex 32)
docker compose up --build -d
```

- Web: `http://localhost:8080` (nginx sirve la SPA y hace de proxy de `/api` y `/ws`).
- API: `http://localhost:3000/health`. Las migraciones y los puzzles se cargan al arrancar.
- Pon delante un proxy con TLS (Caddy, Traefik o el balanceador del proveedor).

## Opción B — Web en Vercel + API en Cloud Run (GitHub Actions)

El workflow [`deploy.yml`](../.github/workflows/deploy.yml) publica las imágenes en GHCR en cada
push a `main` y, si lo activas con variables del repositorio, despliega:

| Destino | Variables (`Settings → Variables`) | Secretos |
| --- | --- | --- |
| Web en Vercel | `DEPLOY_WEB=vercel`, `VITE_API_URL=https://api.tu-dominio` | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| API en Cloud Run | `DEPLOY_API=cloudrun`, `GCP_REGION`, `CLOUD_RUN_SERVICE` | `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` |

Las variables de la API (`JWT_SECRET`, `DATABASE_URL`, `STRIPE_*`, `ANTHROPIC_API_KEY`…) se
configuran en el servicio de Cloud Run desde Secret Manager. La base de datos recomendada es
Cloud SQL para PostgreSQL. El workflow despliega con una instancia y afinidad de sesión porque
el estado de las partidas online vive en memoria (ver [ROADMAP](ROADMAP.md)).

Con dominios separados, añade el de la web a `CORS_ORIGINS` y compila la web con `VITE_API_URL`.

## Opción C — Kubernetes

```bash
kubectl create secret generic ia-ajedrez --from-env-file=.env
kubectl apply -f infra/k8s/
```

Sustituye `ghcr.io/OWNER/...` por tus imágenes y `ajedrez.example.com` por tu dominio. Requiere
nginx-ingress y cert-manager. Mantén `replicas: 1` en la API mientras el multijugador no use un
bus compartido.

## Pagos (Stripe)

1. Crea un producto con precio recurrente y copia su `price_...` en `STRIPE_PRICE_ID`.
2. Crea un webhook a `https://api.tu-dominio/api/payments/webhook` con los eventos
   `checkout.session.completed` y `customer.subscription.deleted`; copia el secreto en
   `STRIPE_WEBHOOK_SECRET`.
3. En local: `stripe listen --forward-to localhost:3000/api/payments/webhook`.

## Tutor con IA generativa

- Claude: `TUTOR_PROVIDER=anthropic` y `ANTHROPIC_API_KEY`. Modelo por defecto `claude-opus-5-5`
  (`TUTOR_MODEL`). Las peticiones activan el reintento en un modelo de respaldo si el modelo
  rechaza la consulta.
- Modelo propio: entrena con `ml/ajedrez_ml/train_tutor.py`, sírvelo con Hugging Face Text
  Generation Inference y define `TUTOR_PROVIDER=hf-tgi` y `HF_TGI_URL`.
- Por defecto el tutor generativo es Premium; `TUTOR_FREE=true` lo abre a todos.

## Apps móviles

Ver [`apps/mobile/README.md`](../apps/mobile/README.md). Compila la web con
`VITE_API_URL=https://api.tu-dominio` y añade `https://localhost` (Android) y
`capacitor://localhost` (iOS) a `CORS_ORIGINS`.

## Observabilidad

- Logs JSON (pino) con cabeceras sensibles redactadas.
- `GET /metrics` en formato Prometheus (conexiones WebSocket, partidas en curso, búsquedas).
- Sentry: instala `@sentry/node` en `apps/server` y define `SENTRY_DSN`.
- `GET /health` (vida) y `GET /ready` (base de datos) para sondas.
