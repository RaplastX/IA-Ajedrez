/**
 * Piezas en pixel art de 32×32 (arte propio, generado por código). Cada pieza se construye con
 * formas (círculos, trapecios, polígonos), recibe contorno y sombreado automáticos (luz desde la
 * izquierda arriba) y después detalles a mano (ojos, gemas, visera). Seis cuadros por pieza:
 *   0 reposo · 1 aplastada · 2 parpadeo · 3 estirada/destello · 4 ataque · 5 daño
 * Leyenda: o contorno · b cuerpo · h luz · s sombra · d sombra profunda · e ojo · i brillo del ojo
 *          a acento · y oro/gema · w blanco · . vacío
 */

type Rows = string[];
type Mask = boolean[][];

export const SIZE = 32;
export const FRAMES = 6;

const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const newMask = (): Mask => Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function set(m: Mask, x: number, y: number, v: boolean) {
  if (inside(x, y)) m[y]![x] = v;
}

/** Elipse (los centros de píxel están en x+0,5 / y+0,5). */
function ell(m: Mask, cx: number, cy: number, rx: number, ry: number) {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) m[y]![x] = true;
    }
}
const ball = (m: Mask, cx: number, cy: number, r: number) => ell(m, cx, cy, r, r);

/** Trapecio simétrico entre las filas y0 (incl.) e y1 (excl.), con semianchos w0 → w1. */
function trap(m: Mask, y0: number, y1: number, w0: number, w1: number, cx = 16) {
  for (let y = y0; y < y1; y++) {
    const hw = lerp(w0, w1, (y - y0 + 0.5) / (y1 - y0));
    for (let x = 0; x < SIZE; x++) if (Math.abs(x + 0.5 - cx) <= hw) set(m, x, y, true);
  }
}

function box(m: Mask, x0: number, y0: number, x1: number, y1: number, v = true) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(m, x, y, v);
}

/** Polígono relleno por líneas de barrido. */
function poly(m: Mask, pts: [number, number][]) {
  for (let y = 0; y < SIZE; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[(i + 1) % pts.length]!;
      if ((y1 <= yc && yc < y2) || (y2 <= yc && yc < y1)) {
        xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]! - 0.5); x <= Math.floor(xs[i + 1]! - 0.5); x++)
        set(m, x, y, true);
    }
  }
}

/** Base común: dos escalones anchos que apoyan en la última fila. */
function plinth(m: Mask) {
  trap(m, 27, 29, 10.5, 10.5);
  trap(m, 29, 31, 12, 12);
}

/** Contorno + sombreado: luz arriba a la izquierda, sombra abajo a la derecha. */
function paint(m: Mask): string[][] {
  const g: string[][] = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));
  const on = (x: number, y: number) => inside(x, y) && m[y]![x]!;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (on(x, y)) {
        let c = 'b';
        if (!on(x + 1, y)) c = 'd';
        else if (!on(x + 2, y) || !on(x + 3, y) || !on(x, y + 1)) c = 's';
        else if (!on(x - 1, y) || !on(x - 2, y) || !on(x, y - 1) || !on(x - 1, y - 1)) c = 'h';
        g[y]![x] = c;
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g[y]![x] = 'o';
    }
  return g;
}

function stamp(g: string[][], x: number, y: number, art: string[]) {
  art.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c !== '.' && inside(x + i, y + j)) g[y + j]![x + i] = c;
    }),
  );
}

/** Cambia el color de un tramo de fila solo donde hay cuerpo (no contorno). */
function hline(g: string[][], y: number, x0: number, x1: number, c: string) {
  for (let x = x0; x <= x1; x++) if ('bhsd'.includes(g[y]![x]!)) g[y]![x] = c;
}

function line(g: string[][], x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(lerp(x0, x1, n ? i / n : 0));
    const y = Math.round(lerp(y0, y1, n ? i / n : 0));
    if (inside(x, y) && 'bhsd'.includes(g[y]![x]!)) g[y]![x] = c;
  }
}

/** Ojos de 2×2 con brillo. */
const EYE = ['ie', 'ee'];

const toRows = (g: string[][]): Rows => g.map((r) => r.join(''));

function pawn(): Rows {
  const m = newMask();
  ball(m, 16, 10.5, 6.3);
  trap(m, 16, 19, 8, 8);
  trap(m, 19, 22, 4.5, 5.5);
  trap(m, 22, 27, 5.5, 9.5);
  plinth(m);
  const g = paint(m);
  hline(g, 18, 9, 22, 'd');
  stamp(g, 12, 9, EYE);
  stamp(g, 18, 9, EYE);
  stamp(g, 15, 13, ['oo']);
  return toRows(g);
}

function rook(): Rows {
  const m = newMask();
  box(m, 6, 3, 25, 9);
  box(m, 10, 3, 12, 5, false);
  box(m, 19, 3, 21, 5, false);
  trap(m, 10, 13, 8, 8);
  trap(m, 13, 25, 7.5, 9);
  trap(m, 25, 27, 10.5, 10.5);
  plinth(m);
  const g = paint(m);
  hline(g, 9, 7, 24, 'd');
  stamp(g, 11, 15, ['ooooo']);
  stamp(g, 17, 15, ['ooooo']);
  stamp(g, 12, 16, EYE);
  stamp(g, 18, 16, EYE);
  for (const y of [20, 23]) hline(g, y, 9, 22, 's');
  for (const x of [14, 19]) line(g, x, 20, x, 22, 's');
  for (const x of [11, 16]) line(g, x, 23, x, 24, 's');
  return toRows(g);
}

function box2(g: string[][], x0: number, y0: number, x1: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y]![x] = c;
}

function bishop(): Rows {
  const m = newMask();
  ball(m, 16, 4.6, 2.1);
  ell(m, 16, 11.5, 6.6, 6.4);
  trap(m, 17, 20, 8.2, 8.2);
  trap(m, 20, 23, 4.5, 5.5);
  trap(m, 23, 27, 6, 9.5);
  plinth(m);
  const g = paint(m);
  hline(g, 19, 9, 22, 'd');
  line(g, 20, 7, 14, 12, 'o');
  stamp(g, 13, 13, EYE);
  stamp(g, 18, 13, EYE);
  stamp(g, 15, 3, ['yy', 'yy']);
  return toRows(g);
}

function queen(): Rows {
  const m = newMask();
  for (const sx of [7.5, 11.8, 16, 20.2, 24.5]) {
    trap(m, 6, 10, 1.2, 2.4, sx);
    ball(m, sx, 4.4, 1.9);
  }
  trap(m, 9, 14, 8.2, 10.4);
  trap(m, 14, 18, 6, 6);
  trap(m, 18, 20, 8.5, 8.5);
  trap(m, 19, 27, 6, 9.5);
  plinth(m);
  const g = paint(m);
  hline(g, 12, 6, 25, 'y');
  hline(g, 19, 8, 23, 'd');
  stamp(g, 12, 14, EYE);
  stamp(g, 18, 14, EYE);
  for (const sx of [7, 11, 15, 20, 24]) stamp(g, sx, 3, ['yy', 'yy']);
  stamp(g, 15, 21, ['yy', 'yy']);
  return toRows(g);
}

function king(): Rows {
  const m = newMask();
  box(m, 14, 1, 17, 8);
  box(m, 11, 3, 20, 4);
  ball(m, 16, 13.5, 6.4);
  trap(m, 18, 21, 8.6, 8.6);
  trap(m, 21, 23, 5, 5.5);
  trap(m, 23, 27, 6, 9.5);
  plinth(m);
  const g = paint(m);
  box2(g, 14, 1, 17, 8, 'y');
  box2(g, 11, 3, 20, 4, 'y');
  stamp(g, 14, 1, ['ww']);
  hline(g, 19, 8, 24, 'y');
  hline(g, 20, 8, 24, 'd');
  hline(g, 12, 11, 21, 'b');
  stamp(g, 12, 12, EYE);
  stamp(g, 18, 12, EYE);
  stamp(g, 15, 16, ['oo']);
  return toRows(g);
}

/** El caballo mira a la izquierda: se construye con polígonos. */
function knight(): Rows {
  const m = newMask();
  poly(m, [
    [11, 9],
    [19, 7],
    [23, 10],
    [25, 15],
    [26, 21],
    [26, 27],
    [8, 27],
    [9, 23],
    [12, 20],
    [8, 21.5],
    [4.5, 22],
    [3, 19.5],
    [3.5, 16.5],
    [7, 12.5],
  ]);
  poly(m, [
    [11, 9.5],
    [12.5, 3],
    [16.5, 8.5],
  ]);
  poly(m, [
    [16, 8],
    [19.5, 3.5],
    [21, 9],
  ]);
  trap(m, 25, 27, 10.5, 10.5);
  plinth(m);
  const g = paint(m);
  // melena: tramos oscuros en el borde trasero del cuello
  for (let y = 10; y <= 25; y += 2) {
    for (let x = 31; x >= 0; x--) {
      if ('bhsd'.includes(g[y]![x]!)) {
        for (let k = 0; k < 4; k++) if ('bhs'.includes(g[y]![x - k]!)) g[y]![x - k] = 'd';
        break;
      }
    }
  }
  stamp(g, 10, 12, EYE);
  stamp(g, 4, 19, ['o']);
  line(g, 4, 22, 9, 21, 'o');
  hline(g, 12, 13, 14, 's');
  return toRows(g);
}

export const BASE: Record<string, Rows> = {
  p: pawn(),
  r: rook(),
  b: bishop(),
  q: queen(),
  k: king(),
  n: knight(),
};

const BLANK = '.'.repeat(SIZE);
const map = (rows: Rows, fn: (c: string) => string): Rows =>
  rows.map((r) => [...r].map(fn).join(''));

/** Aplasta la pieza quitando filas del cuerpo (el resto baja y sigue apoyada). */
const squash = (rows: Rows, at = 19): Rows => {
  const out = rows.filter((_, i) => i !== at && i !== at + 1);
  return [BLANK, BLANK, ...out];
};
/** Estira la pieza duplicando filas del cuerpo (si las dos superiores están libres). */
const stretch = (rows: Rows, at = 19): Rows => {
  if (rows[0] !== BLANK || rows[1] !== BLANK) return rows;
  const out = [...rows];
  out.splice(at, 0, rows[at]!, rows[at]!);
  return out.slice(2);
};

export function frames(type: string): Rows[] {
  const base = BASE[type]!;
  const blink = map(base, (c) => (c === 'e' || c === 'i' ? 'o' : c));
  const hasGem = base.some((r) => r.includes('y'));
  const spark = hasGem ? map(base, (c) => (c === 'y' ? 'w' : c === 'i' ? 'e' : c)) : stretch(base);
  const attack = map(stretch(base), (c) => (c === 'e' ? 'a' : c));
  const hurt = map(squash(base), (c) =>
    c === 'e' || c === 'i' ? 'o' : 'bhsdy'.includes(c) ? 'w' : c,
  );
  return [base, squash(base), blink, spark, attack, hurt];
}

export type Side = 'w' | 'b';

export const PALETTE: Record<Side, Record<string, string>> = {
  // blancas: crema con contorno azul marino
  w: {
    o: '#1b1f4a',
    b: '#fdf1d6',
    h: '#ffffff',
    s: '#cfc8ea',
    d: '#9e97cc',
    e: '#1b1f4a',
    i: '#ffffff',
    a: '#ff2e63',
    y: '#ffd23f',
    w: '#ffffff',
  },
  // negras: azul pizarra con contorno casi negro y ojos rojos
  b: {
    o: '#0b0d24',
    b: '#4a4f9c',
    h: '#8f86d0',
    s: '#383c85',
    d: '#262a66',
    e: '#ff2e63',
    i: '#ffffff',
    a: '#ffd23f',
    y: '#ffd23f',
    w: '#ffffff',
  },
};

const cache = new Map<string, string>();

function render(type: string, side: Side, only?: number): string {
  const key = `${type}${side}${only ?? 'all'}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const all = frames(type);
    const list = only === undefined ? all : [all[only]!];
    const canvas = document.createElement('canvas');
    canvas.width = SIZE * list.length;
    canvas.height = SIZE;
    const g = canvas.getContext('2d');
    if (g) {
      list.forEach((rows, f) => {
        rows.forEach((row, y) => {
          [...row].forEach((c, x) => {
            const color = PALETTE[side][c];
            if (!color) return;
            g.fillStyle = color;
            g.fillRect(f * SIZE + x, y, 1, 1);
          });
        });
      });
      url = canvas.toDataURL('image/png');
    }
  } catch {
    url = '';
  }
  cache.set(key, url);
  return url;
}

/** Hoja con los 6 cuadros (192×32) para animar con CSS. */
export const sheetUrl = (type: string, side: Side) => render(type, side);
/** Un solo cuadro (reposo = 0, daño = 5) como imagen de 32×32. */
export const frameUrl = (type: string, side: Side, frame = 0) => render(type, side, frame);
