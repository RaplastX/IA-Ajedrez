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


## Estilo de las animaciones: pixel art retro

Referencia visual: el estilo de *Shotgun King* (pixel art nítido, paleta de pocos colores, contornos
duros, animación "a saltos"). Todo está dibujado por código con arte propio, sin recursos de ese juego.
El ajedrez en sí no cambia: mismas piezas, mismas reglas.

- Los efectos se dibujan en un canvas de **128×128** (16 píxeles por casilla) que se escala **sin
  suavizado** (`image-rendering: pixelated`). Nada de degradados, brillos ni desenfoques.
- Paleta fija: crema, lavanda, azul marino, rosa, amarillo, naranja, blanco y grises (`lib/pixel.ts`).
- Las animaciones avanzan a ~14 cuadros por segundo y las partículas a 18, con *hit-stop* de 80 ms.
- Al impactar, **todo el tablero se tiñe** del color del arma durante un instante y tiembla en píxeles
  enteros, como en el juego de referencia. El daño aparece como un número pequeño en fuente de píxeles.
- Sin carteles ni onomatopeyas: solo el número de daño y "MATE".

## Armas de cada pieza

Cada captura es un pequeño combate: el atacante vuelve a su casilla, se arma y usa **su arma**; la pieza
capturada parpadea en blanco y se rompe en píxeles. Dibujado en `lib/weapons.ts`, coreografía en
`lib/attackFx.ts`.

| Pieza | Arma | Cómo ataca | Color del destello |
| --- | --- | --- | --- |
| Peón | Daga | Retrocede, se clava y deja un tajo | Rosa |
| Caballo | Lanza con banderín | Carga con líneas de velocidad y la lanza se astilla | Amarillo |
| Alfil | Bastón mágico | Orbe que se carga y rayo con relámpago en zigzag | Lavanda |
| Torre | Cañón | Dispara con fogonazo y retroceso; bala con estela de humo y explosión | Naranja |
| Dama | Sables gemelos | Se cruzan y hacen un tajo en X | Rosa |
| Rey | Escopeta | Carga la corredera, fogonazo, perdigones y humo | Naranja |

**Jaque mate:** si el mate no es una captura, la pieza dispara su arma contra el rey; después el rey se
tambalea y cae, parpadea "MATE" en pixel art y el tablero se sacude con fuerza.

**Movimiento con personalidad:** peón (saltito), caballo (gran salto con giro), alfil (carrera en
diagonal con estela de chispas), torre (desliza pesada y hace temblar el tablero), dama (gira 360° al
moverse) y rey (pisotón).

**Piezas con vida:** ojos que parpadean (rojos y enfadados las negras) y una animación de reposo propia
mientras es tu turno: el caballo mueve la cabeza y patea el suelo, el alfil se mece, la torre respira,
la dama se eleva y el rey se agita nervioso.

**Ajustes:** en Ajustes → "Animaciones y efectos" se pueden apagar; también se desactivan con
"reducir movimiento" del sistema.
