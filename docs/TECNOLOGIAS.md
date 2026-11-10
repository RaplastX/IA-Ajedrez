# Tecnologías: comparativa y decisiones

## Motores, APIs y frameworks

| Tecnología | Coste | Rendimiento | Integración | Licencia | Lenguaje / interfaz | Uso en el proyecto |
| --- | --- | --- | --- | --- | --- | --- |
| **Stockfish 19** | Gratis | El más fuerte en CPU (NNUE) | Muy fácil: UCI; builds WASM listos (stockfish.js) | GPL-3.0 | C++ · UCI | Navegador (WASM lite, ~1,8 MB) y servidor (binario nativo) |
| **Leela Chess Zero** | Gratis | Muy alto con GPU; flojo solo con CPU | Media: UCI, necesita red neuronal y GPU | GPL-3.0 | C++ · UCI | Opcional en servidor (mismo protocolo UCI que Stockfish) |
| **Komodo Dragon** | Licencia de pago | Alto | Fácil (UCI) — es un motor, no una API | Propietaria | C++ · UCI | No usado |
| **Chess.com PubAPI** | Gratis | Solo datos (perfiles, archivos de partidas) | REST de solo lectura | Términos de Chess.com | JSON/HTTP | Importación futura de partidas del usuario |
| **Lichess API / base de datos** | Gratis | Datos y tablebase | REST; dumps mensuales | Base de datos **CC0**; API con términos de uso | JSON/HTTP | Puzzles CC0, tablebase de finales |
| **React + Vite** (web) | Gratis | Muy alto | Alta | MIT | TypeScript | Interfaz web/PWA |
| **Capacitor** (móvil) | Gratis | Alto (WebView nativo) | Alta: reutiliza el 100 % de la web | MIT | TypeScript | Android/iOS |
| **React Native** | Gratis | Muy alto (UI nativa) | Alta, pero sin WebAssembly en el hilo de JS: Stockfish necesitaría un módulo nativo | MIT | TypeScript | Alternativa evaluada |
| **Flutter** | Gratis | Muy alto (AOT) | Media (Dart); Stockfish vía FFI | BSD-3-Clause | Dart | Alternativa evaluada |
| **Node.js + Fastify** | Gratis | Alto: E/S asíncrona en un bucle de eventos (hilos extra con `worker_threads`) | Alta | MIT | TypeScript | API y WebSocket |
| **PostgreSQL / PGlite** | Gratis | Alto | Alta (Drizzle ORM) | PostgreSQL License / Apache-2.0 | SQL | Datos; PGlite (Postgres en WASM) para dev y tests |
| **PyTorch** | Gratis | Alto (GPU/CPU) | Alta | BSD-3-Clause | Python | Red de política/valor |
| **TensorFlow** | Gratis | Alto (GPU/TPU) | Alta | Apache-2.0 | Python | No usado (PyTorch cubre el caso) |
| **Hugging Face Transformers** | Gratis (los modelos tienen su propia licencia) | Según el modelo | Alta | Apache-2.0 | Python | Ajuste fino del tutor propio (flan-t5) |
| **Claude (Anthropic API)** | Pago por uso | Muy alto en explicación | SDK oficial | Términos comerciales | TypeScript SDK | Tutor Premium (`claude-opus-5-5`) |

### Correcciones respecto al borrador inicial

- **Node.js "multihilo"**: el JavaScript corre en un único hilo con bucle de eventos; el paralelismo
  real se consigue con `worker_threads` o procesos (aquí, Stockfish es un proceso aparte).
- **Leela "Python/C++"**: Lc0 es C++; su fuerza depende de la GPU.
- **Komodo "API comercial"**: es un motor UCI de pago, no un servicio web.
- **Chess.com PubAPI**: es de solo lectura y no ofrece análisis; revisa sus términos antes de
  usarla en producción.

## Decisiones clave

### Capacitor en lugar de React Native o Flutter
El corazón de la app es Stockfish. En el navegador y en el WebView de Capacitor corre como
WebAssembly en un Web Worker sin cambiar una línea. Con React Native o Flutter habría que
compilar y mantener Stockfish como módulo nativo por plataforma (JNI/Objective-C/FFI). Capacitor
permite **un solo código** para web, Android e iOS, probado de extremo a extremo con Playwright.
Si en el futuro se necesitan vistas nativas puntuales, Capacitor admite plugins nativos.

### Tablero propio en lugar de chessboard.js
chessboard.js depende de jQuery. El tablero propio (`apps/web/src/components/Board`) ofrece clic y
arrastre (Pointer Events, táctil), coronación, flechas, resaltados, coordenadas y accesibilidad
(cada casilla es un botón con etiqueta "e4, caballo blanco"). La lógica de reglas es **chess.js**.

### Stockfish "lite single-threaded"
La variante completa pesa ~100 MB y la multihilo exige aislamiento entre orígenes (COOP/COEP). La
"lite single" pesa ~1,8 MB, funciona en cualquier hosting estático y en móviles, y sigue siendo
muchísimo más fuerte que cualquier humano. En el servidor se usa el binario nativo.

**Compilar Stockfish a WASM tú mismo** (solo si necesitas modificar el motor): clona
[nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js), instala emscripten (versión
indicada en su README) y ejecuta `./build.js --single-threaded --lite`. Copia el `.js` y el `.wasm`
generados en `apps/web/public/engine/` con los nombres `stockfish.js` / `stockfish.wasm`.

### Fuerza ajustable del motor
Stockfish solo acepta `UCI_Elo` desde ~1320. Por debajo, la app combina `Skill Level`, poca
profundidad y una elección "humana" entre las 5 mejores jugadas con probabilidad
∝ exp(−pérdida/T): la IA de 600 comete errores verosímiles en vez de jugar perfecto y regalar
piezas al azar (`packages/core/src/engine/strength.ts`).

### TypeScript 6.0
TypeScript 7 (compilador nativo) aún no expone la API de JavaScript que necesita
`typescript-eslint`. Se fija la 6.0 hasta que el ecosistema de linters la soporte.

### Tutor: reglas primero, LLM después
El motor calcula y las reglas extraen hechos verificables; el LLM solo redacta. Así el tutor
funciona gratis y sin red (reglas), y la versión generativa no "alucina" evaluaciones. El
proveedor se elige con `TUTOR_PROVIDER` (`rules`, `anthropic`, `hf-tgi`). Con Claude se usa el
modelo `claude-opus-5-5` con esfuerzo bajo (explicaciones breves) y **reintento automático en un
modelo de respaldo si el modelo rechaza la petición** (`fallbacks: "default"`).

## Herramientas y librerías

| Área | Elección |
| --- | --- |
| Estado (web) | Zustand con persistencia tolerante a fallos |
| i18n | i18next + react-i18next (es/en, plurales) |
| Validación (API) | zod |
| ORM | Drizzle (PostgreSQL / PGlite) |
| Pagos | Stripe Checkout + webhooks firmados |
| Tests | Vitest (unitarios/integración), Playwright (e2e web y móvil), pytest |
| Calidad | ESLint (typescript-eslint, reglas del compilador de React), Prettier, ruff |
| CI/CD | GitHub Actions (lint, tipos, tests, e2e, Python, imágenes Docker, despliegue) |
| Observabilidad | Logs estructurados (pino), `/metrics` Prometheus, Sentry opcional |
| Analítica | Endpoint configurable, solo tras consentimiento explícito |
