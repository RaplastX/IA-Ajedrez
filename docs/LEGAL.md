# Checklist legal y de privacidad

> Esta lista resume obligaciones habituales y lo que el código ya implementa. **No es asesoramiento
> jurídico**: revísala con un profesional antes del lanzamiento, sobre todo los puntos marcados ⚠️.

## 1. Protección de datos (RGPD, LOPDGDD en España, LOPDP en Ecuador)

| Requisito | Estado en el código | Pendiente |
| --- | --- | --- |
| Minimización de datos | Correo, nombre visible, contraseña (hash scrypt), progreso, intentos y partidas. Los invitados no dan datos personales. | — |
| Base jurídica y consentimiento | Casilla obligatoria de términos y privacidad al registrarse (`termsAcceptedAt`). Analítica **solo tras consentimiento** (aviso inicial, revocable en Ajustes). | Redactar política de privacidad y términos; enlazarlos en el registro |
| Derecho de acceso y portabilidad (art. 15 y 20) | `GET /api/me/export` + exportación local en Ajustes (JSON) | — |
| Derecho de supresión (art. 17) | `DELETE /api/me` borra la cuenta en cascada y anonimiza el nombre en partidas compartidas; Ajustes borra también los datos locales | Definir plazo de borrado en copias de seguridad |
| Privacidad por diseño | Funciona sin cuenta; la clasificación muestra solo el nombre visible; contraseñas con scrypt; JWT; TLS en producción (Ingress/Vercel/Cloud Run) | Cifrado en reposo de la base de datos (activar en el proveedor gestionado) |
| Encargados del tratamiento | — | ⚠️ Contratos (DPA) con: hosting/BD, Stripe, Anthropic (si `TUTOR_PROVIDER=anthropic`), Sentry/analítica |
| Transferencias internacionales | — | ⚠️ Si los proveedores están fuera del EEE: cláusulas contractuales tipo o equivalentes; informar en la política |
| Registro de actividades de tratamiento | — | Documentar finalidades, categorías, plazos |
| Menores | — | ⚠️ El ajedrez atrae a menores. La edad de consentimiento digital varía por país (en España, 14 años según la LOPDGDD). Añadir verificación de edad o consentimiento parental si el público objetivo incluye menores |
| Cookies / almacenamiento local | Solo almacenamiento técnico (progreso, ajustes, sesión). Sin cookies de terceros. | Mencionarlo en la política; si se añade analítica de terceros, mantener el consentimiento previo |
| Brechas de seguridad | Logs con cabeceras sensibles redactadas | Procedimiento de notificación (72 h a la autoridad en el RGPD) |

## 2. Licencias de software

| Componente | Licencia | Obligaciones |
| --- | --- | --- |
| **Stockfish / stockfish.js** | GPL-3.0 | ⚠️ Al distribuir el binario/WASM hay que ofrecer su código fuente y el texto de la licencia. La app lo hace: el texto se sirve en `/engine/COPYING-stockfish.txt` y Ajustes → Licencias enlaza al código fuente. Stockfish se ejecuta como **programa independiente** (Web Worker / proceso hijo) comunicándose por UCI, lo que habitualmente se interpreta como "agregado" y no obliga a liberar la app; confírmalo con un abogado. Si modificas el motor, publica tus cambios. |
| Stockfish en iOS (App Store) | GPL-3.0 | ⚠️ Los términos de la App Store se han considerado incompatibles con la GPL en algunos casos. Valora publicar la app iOS sin motor (análisis en servidor) o pedir consejo legal |
| Leela Chess Zero (si se añade) | GPL-3.0 | Mismas consideraciones que Stockfish |
| chess.js | BSD-2-Clause | Mantener aviso de copyright |
| React, React Router, Zustand, i18next, Fastify, Drizzle, Vite, Capacitor | MIT | Mantener avisos de licencia (se incluyen en los paquetes) |
| PGlite | Apache-2.0 / PostgreSQL | Aviso de licencia |
| PyTorch | BSD-3-Clause | Aviso de licencia |
| Transformers | Apache-2.0 | Aviso; **cada modelo tiene su propia licencia** (flan-t5: Apache-2.0) |
| SDK de Anthropic, Stripe | MIT / términos del servicio | Cumplir términos de uso de cada API |

**Licencia del propio proyecto:** el repositorio no declara aún una licencia (por defecto, todos los
derechos reservados). Decide si será propietario o libre (p. ej. GPL-3.0, que simplificaría la
convivencia con Stockfish) y añade un archivo `LICENSE`.

## 3. Contenidos, datos y propiedad intelectual

| Recurso | Licencia | Notas |
| --- | --- | --- |
| Piezas "Cburnett" (Wikimedia Commons) | Triple licencia GFDL / BSD / GPL | Se usan bajo BSD; atribución a Cburnett en Ajustes → Licencias |
| Puzzles de Lichess | CC0 | Sin obligaciones; se enlaza a cada puzzle original por cortesía |
| Nombres de aperturas (lichess-org/chess-openings) | CC0 | — |
| Tablebase de Lichess (API) | Servicio gratuito | Respetar límites de uso; considerar alojar tablebases Syzygy propias a gran escala |
| Partidas de TWIC / PGN Mentor | Términos de cada sitio | ⚠️ Verificar antes de redistribuirlas |
| Chess.com PubAPI | Términos de Chess.com | ⚠️ No usar su marca ni imitar su interfaz; solo datos del usuario con su permiso |
| Iconos, fotos, animaciones de terceros | Según cada banco (Font Awesome Free: CC BY 4.0 iconos / SIL OFL fuentes / MIT código; Unsplash y Pixabay: licencias propias, no CC0; Flaticon: licencia propia con atribución) | Guardar la licencia y la atribución de cada recurso en `docs/RECURSOS.md` |
| Marcas | — | No usar marcas de terceros (Chess.com, Lichess, FIDE) en nombre, logo o publicidad |

## 4. Pagos y consumo

- Stripe Checkout aloja el formulario: la app no toca datos de tarjeta (alcance PCI mínimo).
- ⚠️ Informar precio, renovación y cancelación antes del pago; derecho de desistimiento en la UE
  para contenidos digitales (con consentimiento expreso para la ejecución inmediata).
- ⚠️ Compras dentro de apps móviles: las tiendas pueden exigir su propio sistema de pago para
  contenido digital. Revisa las políticas vigentes de Google Play y App Store.
- Facturación e impuestos (IVA/OSS en la UE) según el país del vendedor.

## 5. IA generativa

- Informar de que las explicaciones del tutor Premium las genera un modelo de IA.
- El tutor solo recibe la posición, la jugada, los hechos del motor y la pregunta del alumno: no
  se envían datos personales. Mantenerlo así.
- Revisar las políticas de uso del proveedor del modelo.

## 6. Antes del lanzamiento

- [ ] Política de privacidad, términos de uso y aviso de cookies publicados y enlazados.
- [ ] DPA firmados con todos los encargados; registro de actividades.
- [ ] Decisión sobre menores y verificación de edad.
- [ ] Licencia del proyecto decidida (`LICENSE`).
- [ ] Revisión legal de la distribución de Stockfish (web, Android, iOS).
- [ ] Atribuciones de todos los recursos gráficos registradas.
- [ ] Pruebas de exportación y borrado de cuenta en producción.
