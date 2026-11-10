# Roadmap

## Fase 1 — MVP (hecho en este repositorio)

- [x] Núcleo compartido con tests: UCI, precisión, clasificación de jugadas, Glicko-2, SM-2,
      bandido de dificultad, debilidades, gamificación, PGN, puzzles, tutor por reglas.
- [x] Web/PWA bilingüe con Stockfish WASM: jugar contra la IA (400–3000 Elo), análisis con
      precisión y curva de evaluación, táctica adaptativa, puzzle del día, "mis errores",
      aperturas con SM-2, finales con tablebase, lecciones, progreso, logros, retos diarios.
- [x] API: cuentas e invitados, sincronización, rating validado en servidor, clasificación,
      multijugador con reloj y chat, RGPD (exportar/borrar), tutor (reglas/Claude/TGI), Stripe,
      análisis con Stockfish nativo, métricas.
- [x] App móvil con Capacitor (Android/iOS).
- [x] ML: preprocesado PGN, generación de puzzles con motor, red de política (PyTorch), tutor
      propio (Transformers), simulación de RL para la dificultad.
- [x] Docker, Compose, Kubernetes, CI (lint, tipos, unitarios, e2e, Python, imágenes) y despliegue.

## Fase 2 — Beta pública

- [ ] Políticas legales publicadas y revisión de la licencia de Stockfish por plataforma (ver LEGAL).
- [x] Tema oscuro premium, animaciones de piezas, partículas, confeti, sonidos y vibración.
- [ ] Ilustraciones y animaciones Lottie/Rive propias (personajes) diseñadas en Figma/Rive.
- [ ] Inicio de sesión con Google/Apple (OAuth 2.0 / OpenID Connect).
- [ ] Recuperación de contraseña y verificación de correo.
- [ ] Banco de puzzles ampliado (≥ 20 000) servido desde la API por páginas.
- [ ] Más lecciones (estructuras de peones, planes típicos por apertura) y más finales.
- [ ] Importar partidas desde Lichess / Chess.com por nombre de usuario (con su permiso).
- [ ] Prueba A/B de la política de dificultad con datos reales (Thompson vs. rating puro).

## Fase 3 — Escala

- [ ] Multijugador horizontal: estado de partidas en Redis y pub/sub entre réplicas.
- [ ] Rating Glicko-2 para partidas online y emparejamiento por rating.
- [ ] Análisis de partidas en cola en el servidor (BullMQ) para usuarios sin WASM.
- [ ] Modelo de política propio en el navegador (ONNX Runtime Web) como rival "humano".
- [ ] Torneos, amigos, clubs y moderación del chat.
- [ ] Panel de administración y analítica de aprendizaje (retención, mejora de rating).

## Riesgos conocidos

| Riesgo | Mitigación |
| --- | --- |
| La XP la declara el cliente | El ranking competitivo usa el rating de táctica (validado en servidor); XP solo informativa |
| Multijugador en memoria | Una réplica con afinidad; Redis en fase 3 |
| Tablebase externa | Respaldo con Stockfish sin conexión; alojar Syzygy propias si crece el uso |
| GPL de Stockfish en tiendas | Revisión legal; alternativa de análisis en servidor |
