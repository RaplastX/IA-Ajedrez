# Diseño premium y animaciones

## Por qué no Flutter

La guía de diseño proponía Flutter + Flame. La app ya existe en React + Capacitor y se publica en
Android e iOS desde el mismo código, con Stockfish (WASM) funcionando dentro del WebView y una
batería de tests e2e que la valida. Reescribirla en Dart duplicaría el trabajo sin ganar
funcionalidad. Todo lo que pedía la guía (tema oscuro, deslizamiento de piezas, partículas,
microinteracciones, sonido, vibración, intro animada) está implementado **por código** en la app
actual. Si en el futuro se quisiera Flutter, `packages/core` (la lógica) se puede portar tal cual
y el paquete `stockfish` de Dart cubriría el motor.

## Sistema visual (a partir del logo: caballo cromado sobre cristal negro)

| Token | Oscuro (por defecto) | Uso |
| --- | --- | --- |
| `--bg` | `#030304` | Negro profundo con reflejos radiales plateados muy tenues |
| `--surface` / `--surface-2` | `#0d0e10` / `#17181c` | Tarjetas y controles (cristal oscuro) |
| `--text` | `#f2f4f7` | Texto principal |
| `--accent` / `--accent-2` | `#d6dbe2` / `#8e959f` | Cromo: degradado metálico de los botones primarios |

- Verde y rojo solo para acierto/error. Tema claro y "según el sistema" disponibles en Ajustes.
- Tablero *Medianoche* (grafito) por defecto, con un brillo especular que lo recorre como el cristal
  del logo; *Ébano* y los clásicos como alternativa.
- Logo: `apps/mobile/resources/` (original e icono 1024 px) y `apps/web/public/icon-*.png`.

## Animaciones (todas por código, sin assets externos)

| Momento | Efecto | Dónde |
| --- | --- | --- |
| Abrir la app | Intro del logo (escala con rebote, brillo y título que se condensa) una vez por sesión | `components/effects.tsx` (`Splash`) |
| Cambiar de página | Fundido y desplazamiento suave | `.page` en `styles.css` |
| Seleccionar pieza | Se levanta con rebote; el **caballo balancea la cabeza** y dama/rey brillan | `board.css` |
| Mover | Salto en arco con estiramiento en el aire, aplastamiento al aterrizar y polvo (estilo Gambonanza) | `Board.tsx`, `lib/fx.ts` |
| Turno propio | Las piezas que pueden moverse "respiran" con desfase; se elevan al pasar el ratón | `board.css` |
| Capturar | Destello blanco, la pieza rival sale volando girando, fragmentos cromados, chispas, humo, número flotante "+N" con el material y temblor del tablero según su valor (estilo Shotgun King) | `Board.tsx`, `lib/fx.ts` |
| Jaque | Halo rojo que late y el rey tiembla + campana | `board.css`, `lib/sound.ts` |
| Jaque mate | El rey derrotado se tambalea y cae, explosión y sacudida del tablero | `Board.tsx` |
| Acierto / logro | Confeti cromado a pantalla completa, arpegio y vibración de éxito | `lib/feedback.ts`, `Celebration` |
| Fallo | Mensaje que tiembla, tono grave y vibración de error | `styles.css`, `lib/feedback.ts` |
| Botones y tarjetas | Rebote al pulsar, elevación con brillo plateado al pasar el dedo/ratón | `styles.css` |
| Insignias ganadas | Destello periódico del icono | `styles.css` |

El sistema de partículas (`ParticleSystem`) es un Canvas 2D con `requestAnimationFrame` que se
detiene solo cuando no quedan partículas; la física (`stepParticle`) es una función pura testeada.

**Sonido:** sintetizado con Web Audio (golpe de madera, captura, campana, arpegio): no hay archivos
ni licencias. **Vibración:** `@capacitor/haptics` (nativo en Android/iOS; `navigator.vibrate` en la
web).

**Accesibilidad:** con "reducir movimiento" del sistema o el interruptor de Ajustes se desactivan
animaciones, partículas, confeti y vibración. El sonido tiene su propio interruptor.

## Ampliar con Lottie, Rive o grabaciones

- **Lottie:** `npm i @lottiefiles/dotlottie-web` y un `<canvas>` con
  `new DotLottie({ canvas, src: '/anim/victoria.lottie', autoplay: true })`, por ejemplo dentro de
  `Celebration`.
- **Rive:** `npm i @rive-app/canvas` y `new Rive({ src: '/anim/caballo.riv', canvas, stateMachines: '...' })`
  para personajes con máquinas de estado (p. ej. un caballo que reacciona a tus jugadas).
- **Sonidos grabados:** decodifica los archivos con `AudioContext.decodeAudioData` y sustituye las
  funciones de `lib/sound.ts`.

## Fuentes de recursos y sus licencias

Verifica la licencia de **cada archivo** y anótala en [RECURSOS.md](RECURSOS.md):

| Fuente | Licencia (resumen; consulta la vigente) |
| --- | --- |
| Pexels, Unsplash, Pixabay (fotos, sonidos) | Licencias propias: uso comercial gratuito, con restricciones (p. ej. no revender sin modificar) |
| FreeSVG, OpenClipart | Dominio público (CC0) |
| Freesound | Por archivo: CC0, CC BY o CC BY-NC (este último no permite uso comercial) |
| LottieFiles, IconScout | Por animación: gratuitas con condiciones o de pago |
| SF Symbols | Solo en apps para plataformas de Apple, según su licencia |
| Juegos de referencia (*Shotgun King*, *Battle Chess*) | Solo inspiración: no copiar arte, personajes ni sonidos |
