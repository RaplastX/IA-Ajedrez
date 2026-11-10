# IA Ajedrez

Plataforma de entrenamiento de ajedrez con IA para web, Android e iOS (español e inglés):
juega contra Stockfish a tu nivel, analiza tus partidas, entrena táctica que se adapta a ti,
memoriza aperturas, domina finales teóricos y sigue tu progreso.

## Funcionalidades

| Módulo | Qué hace |
| --- | --- |
| **Jugar vs IA** | Stockfish 19 (WASM, en el dispositivo) de 400 a 3000 Elo. Por debajo de 1320 elige entre varias jugadas candidatas para cometer errores "humanos". Deshacer, abandonar, PGN, tiempo medio por jugada. |
| **Análisis** | Pega o sube un PGN: evaluación de cada jugada, precisión (fórmula de Lichess), pérdida media, clasificación (libro, mejor, imprecisión, error, error grave), curva de evaluación, apertura detectada, tutor que explica cada jugada y PGN anotado. |
| **Ejercicios con tus errores** | Cada error grave analizado se convierte en un puzzle personal ("Mis errores"). |
| **Táctica** | 607 puzzles reales (Lichess, CC0) de 500 a 2800 y 60+ temas. Rating Glicko-2, dificultad adaptativa (muestreo de Thompson), filtro por tema, puzzle del día, pistas y solución. |
| **Aperturas** | 10 líneas de repertorio (blancas y negras) con ideas y práctica con repetición espaciada SM-2. |
| **Finales** | 8 finales teóricos (mate con dama/torre/alfiles, Lucena, Philidor, oposición…) contra la tablebase Syzygy: el rival juega perfecto y la app detecta la jugada que tira el resultado. |
| **Lecciones** | Estrategia y táctica básica paso a paso con ejercicios en el tablero. |
| **Progreso** | Gráficas de rating y precisión, acierto por tema, errores por fase y recomendaciones de qué entrenar. |
| **Gamificación** | XP, niveles y títulos, rachas, 20 insignias, retos diarios y clasificación. |
| **Multijugador** | Partidas en tiempo real (1+0 a 10+5) con reloj en el servidor, chat y reconexión. |
| **Tutor con IA** | Explicaciones por reglas (gratis, sin conexión) y, en Premium, en lenguaje natural con Claude o un modelo propio de Hugging Face. |
| **Cuenta y privacidad** | Uso sin cuenta o con cuenta/invitado; sincronización; exportar y borrar datos (RGPD); analítica solo con consentimiento. |
| **Premium** | Suscripción con Stripe Checkout. |
| **Diseño premium** | Negro y cromo como el logo, intro animada, piezas que saltan con aplastamiento, animaciones en pixel art retro: cada pieza con su arma (daga, lanza, rayo mágico, cañón, sables, escopeta), ojos y reposo propio, halo de jaque, confeti en los logros, sonidos sintetizados y vibración háptica. Respeta "reducir movimiento". |

## Estructura

```
.
├── packages/core        Lógica de ajedrez compartida (TypeScript, con tests)
├── apps/web             App React + Vite (PWA) con Stockfish WASM
│   ├── src/components   Tablero, gráficos, lista de jugadas…
│   ├── src/pages        Jugar, Análisis, Táctica, Aperturas, Finales, Lecciones, Progreso…
│   ├── src/data         Puzzles, aperturas, repertorio, finales, lecciones
│   ├── test · e2e       Vitest y Playwright
│   └── Dockerfile       nginx con la SPA y proxy de la API
├── apps/server          API Fastify + PostgreSQL (Drizzle) + WebSocket
│   ├── src/routes       Cuentas, entrenamiento, IA, pagos
│   ├── src/realtime     Multijugador
│   ├── src/tutor        Proveedores del tutor (reglas, Claude, HF TGI)
│   └── Dockerfile       Imagen con Stockfish nativo
├── apps/mobile          Capacitor (Android/iOS)
├── ml                   Python: datos PGN, puzzles, RL de dificultad, PyTorch, Transformers
├── infra                nginx y Kubernetes
├── scripts              Generación de datos (puzzles, aperturas)
├── docs                 Arquitectura, tecnologías, datos, legal, despliegue, roadmap
└── .github/workflows    CI y despliegue
```

## Puesta en marcha

Requisitos: Node.js 22 y npm. Python 3.10+ solo para `ml/`.

```bash
npm ci
npm run dev              # web en http://localhost:5173 (funciona sin servidor)
```

Con servidor (cuentas, ranking, multijugador, tutor Premium, pagos):

```bash
cp .env.example .env     # define JWT_SECRET
npm run dev:server       # API en :3000 (lee .env; sin DATABASE_URL usa PGlite en memoria)
```

Vite hace de proxy de `/api` y `/ws` hacia `localhost:3000`. Para persistir datos en local usa
`PGLITE_DIR=./.data` o `DATABASE_URL` de un PostgreSQL. Todo junto con Docker:
`docker compose up --build` (web en `:8080`).

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` / `npm run dev:server` | Web / API en desarrollo |
| `npm test` | Tests unitarios e integración de todos los paquetes |
| `npm run e2e` | Tests de extremo a extremo (Playwright, escritorio y móvil) |
| `npm run lint` · `npm run format:check` · `npm run typecheck` | Calidad |
| `npm run build` | Compila web (`apps/web/dist`) y API (`apps/server/dist`) |
| `npm run data:puzzles -- <csv>` · `npm run data:openings` | Regenera datos |
| `npm run android -w @ia-ajedrez/mobile` | Compila y abre el proyecto Android |
| `cd ml && pytest` | Tests de Python |

## Calidad verificada

- 46 tests del núcleo, 18 de la web y 29 de la API (incluye WebSocket real, firma de webhooks de
  Stripe, análisis con Stockfish y RGPD); 8 e2e con Stockfish real en Chromium (escritorio y
  móvil); 12 tests de Python (incluye generación de puzzles con motor y entrenamiento PyTorch).
- Los datos se validan en los tests: los 607 puzzles se resuelven con su solución, el repertorio
  y las lecciones son legales y los finales se verificaron con la tablebase.

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md) — diagramas, API, modelo de datos y seguridad
- [Tecnologías](docs/TECNOLOGIAS.md) — comparativa de motores y frameworks, y decisiones
- [Datos](docs/DATOS.md) — fuentes y preprocesado
- [Legal y privacidad](docs/LEGAL.md) — checklist RGPD/LOPDP y licencias
- [Despliegue](docs/DESPLIEGUE.md) — Compose, Vercel + Cloud Run, Kubernetes, Stripe, móvil
- [Recursos](docs/RECURSOS.md) — enlaces y activos visuales con su licencia
- [Diseño y animaciones](docs/ANIMACIONES.md) — tema premium, efectos y cómo añadir Lottie/Rive
- [Roadmap](docs/ROADMAP.md)

## Licencias de terceros

Stockfish (GPL-3.0) se distribuye como programa independiente con su licencia en
`/engine/COPYING-stockfish.txt`; piezas y efectos en pixel art de dibujo propio; puzzles y aperturas de Lichess (CC0).
Detalle completo en [docs/LEGAL.md](docs/LEGAL.md). El proyecto aún no declara licencia propia.
