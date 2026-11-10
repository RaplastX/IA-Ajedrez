# Recursos, enlaces y activos visuales

## Usados en el proyecto (con su licencia)

| Recurso | Uso | Licencia | Atribución |
| --- | --- | --- | --- |
| [Stockfish](https://stockfishchess.org) · [stockfish.js](https://github.com/nmrugg/stockfish.js) | Motor (WASM y nativo) | GPL-3.0 | Texto en `/engine/COPYING-stockfish.txt` |
| [Piezas Cburnett](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces) | Piezas del tablero | GFDL / BSD / GPL (usadas bajo BSD) | "Piezas: Cburnett, Wikimedia Commons" |
| [Puzzles de Lichess](https://database.lichess.org/#puzzles) | Banco de táctica | CC0 | Enlace a cada puzzle |
| [chess-openings](https://github.com/lichess-org/chess-openings) | Nombres de aperturas | CC0 | — |
| [Tablebase de Lichess](https://tablebase.lichess.ovh) | Finales exactos | API gratuita | — |
| Logo (caballo cromado) | `apps/web/public/icon-*.png`, `apps/mobile/resources/` | Propio (proporcionado por el cliente) | — |

## Documentación técnica

- Stockfish: <https://stockfishchess.org> · protocolo UCI: <https://backscattering.de/chess/uci/>
- Leela Chess Zero: <https://lczero.org>
- Lichess API: <https://lichess.org/api> · base de datos: <https://database.lichess.org>
- Chess.com PubAPI: <https://www.chess.com/news/view/published-data-api>
- chess.js: <https://github.com/jhlywa/chess.js> · python-chess: <https://python-chess.readthedocs.io>
- React: <https://react.dev> · Vite: <https://vite.dev> · Capacitor: <https://capacitorjs.com>
- Fastify: <https://fastify.dev> · Drizzle ORM: <https://orm.drizzle.team> · PGlite: <https://pglite.dev>
- PyTorch: <https://pytorch.org> · Hugging Face Transformers: <https://huggingface.co/docs/transformers>
- Claude API: <https://platform.claude.com/docs>
- Stripe Checkout: <https://docs.stripe.com/payments/checkout>
- RGPD (texto oficial): <https://eur-lex.europa.eu/eli/reg/2016/679/oj> · AEPD: <https://www.aepd.es>

## Activos visuales para el diseño (fase 2)

Revisa la licencia de **cada** recurso y anótala en la tabla de arriba antes de usarlo.

| Tipo | Opciones | Licencia (verificar) |
| --- | --- | --- |
| Iconos de interfaz | Material Symbols (Google), Font Awesome Free, Lucide | Apache-2.0 · CC BY 4.0 (iconos) / SIL OFL (fuentes) / MIT (código) · ISC |
| Iconos de ajedrez | Flaticon | Licencia propia de Flaticon (gratis con atribución o premium) |
| Sprites y UI de juego | Kenney | CC0 |
| Sets de piezas alternativos | Sets de Lichess (lila), Wikimedia Commons | Varía por set (GPL, CC BY-SA, MIT…) |
| Fotos | Unsplash, Pixabay | Licencias propias (no CC0): uso libre con restricciones |
| Fotos comerciales | Shutterstock, Getty Images, Envato Elements | Licencia de pago por recurso o suscripción |
| Animaciones | LottieFiles (celebraciones, transiciones), GSAP para la web | Licencia por animación en LottieFiles; GSAP gratuito incluido uso comercial |
| Animación esquelética | Spine | Licencia comercial |
| Tipografía | Google Fonts (p. ej. Inter, Noto Sans) | SIL OFL |
| Diseño y prototipos | Figma, Framer, Adobe Illustrator/XD | Herramientas (sin efecto en la licencia del producto) |

La interfaz actual usa la fuente del sistema, colores con modo claro/oscuro definidos en
`apps/web/src/styles.css` y emojis del sistema para los iconos de navegación e insignias, de modo
que no depende de activos con licencia de terceros salvo las piezas.
