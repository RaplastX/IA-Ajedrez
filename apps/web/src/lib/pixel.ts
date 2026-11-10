/**
 * Primitivas de pixel art para dibujar efectos en un canvas de baja resolución (256×256 para
 * el tablero: 32×32 píxeles de juego por casilla) que luego se escala sin suavizado.
 * Paleta limitada y contornos duros, como en los juegos retro: nada de degradados ni brillos.
 */

export const C = {
  cream: '#fdf1d6',
  lav: '#9a8fd1',
  navy: '#1b1f4a',
  pink: '#ff2e63',
  yellow: '#ffd23f',
  orange: '#ff8a3c',
  white: '#ffffff',
  steel: '#c9cfe3',
  gray: '#6b6f8a',
  wood: '#9c6b3f',
  smoke: '#b9b4d6',
} as const;

export type Ctx = CanvasRenderingContext2D;

/** Factor de tamaño de las armas: escala anchos, radios y recuadros (los efectos de texto usan 1). */
export const zoom = { k: 1 };
const z = (n: number) => n * zoom.k;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const seg = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(z(w))),
    Math.max(1, Math.round(z(h))),
  );
}

/** Línea de Bresenham con grosor en píxeles enteros. */
export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 1) {
  g.fillStyle = color;
  w = Math.max(1, Math.round(z(w)));
  let ax = Math.round(x0);
  let ay = Math.round(y0);
  const bx = Math.round(x1);
  const by = Math.round(y1);
  const dx = Math.abs(bx - ax);
  const dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx + dy;
  const off = Math.floor(w / 2);
  for (let i = 0; i < 400; i++) {
    g.fillRect(ax - off, ay - off, w, w);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ax += sx;
    }
    if (e2 <= dx) {
      err += dx;
      ay += sy;
    }
  }
}

/** Línea con contorno azul marino (el sello del pixel art). */
export function outlined(
  g: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  color: string,
) {
  line(g, x0, y0, x1, y1, C.navy, w + 2);
  line(g, x0, y0, x1, y1, color, w);
}

/** Círculo relleno; con `dither` solo pinta casillas alternas (desvanecido retro). */
export function disc(g: Ctx, cx: number, cy: number, r: number, color: string, dither = false) {
  g.fillStyle = color;
  r = z(r);
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      if (x * x + y * y > r * r) continue;
      if (dither && (Math.round(cx) + x + Math.round(cy) + y) % 2 !== 0) continue;
      g.fillRect(Math.round(cx) + x, Math.round(cy) + y, 1, 1);
    }
  }
}

export function ring(g: Ctx, cx: number, cy: number, r: number, color: string) {
  g.fillStyle = color;
  r = z(r);
  const n = Math.max(12, Math.round(r * 7));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}

/** Estallido: rayos desde el centro (como el destello de una explosión de 8 bits). */
export function burst(
  g: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  spokes = 8,
  rot = 0,
  w = 1,
) {
  for (let i = 0; i < spokes; i++) {
    const a = rot + (i / spokes) * Math.PI * 2;
    line(
      g,
      x + Math.cos(a) * r * 0.3,
      y + Math.sin(a) * r * 0.3,
      x + Math.cos(a) * r,
      y + Math.sin(a) * r,
      color,
      w,
    );
  }
}

// ------------------------------------------------------------------ fuente de píxeles 3×5

const GLYPHS: Record<string, string> = {
  '0': '111101101101111',
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001001001001',
  '8': '111101111101111',
  '9': '111101111001111',
  '+': '000010111010000',
  M: '1000111011101011000110001',
  A: '010101111101101',
  T: '111010010010010',
  E: '111100110100111',
  '!': '010010010000010',
};

/** Texto en fuente de píxeles 3×5 centrado en (x, y), con contorno. */
export function text(
  g: Ctx,
  str: string,
  x: number,
  y: number,
  scale: number,
  color: string,
  outline: string = C.navy,
) {
  const widthOf = (ch: string) => (GLYPHS[ch] ? GLYPHS[ch]!.length / 5 : 3);
  const advance = (ch: string) => (widthOf(ch) + 1) * scale;
  const total = [...str].reduce((n, ch) => n + advance(ch), 0) - scale;
  const x0 = Math.round(x - total / 2);
  const y0 = Math.round(y - (5 * scale) / 2);
  const paint = (dx: number, dy: number, c: string) => {
    g.fillStyle = c;
    let cx = x0;
    for (const ch of str) {
      const glyph = GLYPHS[ch];
      const w = widthOf(ch);
      if (glyph) {
        for (let k = 0; k < glyph.length; k++) {
          if (glyph[k] === '1')
            g.fillRect(
              cx + (k % w) * scale + dx,
              y0 + Math.floor(k / w) * scale + dy,
              scale,
              scale,
            );
        }
      }
      cx += advance(ch);
    }
  };
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
  ] as const) {
    paint(dx, dy, outline);
  }
  paint(0, 0, color);
}
