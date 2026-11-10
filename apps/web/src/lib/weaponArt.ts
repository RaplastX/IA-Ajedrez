/**
 * Sprites de las armas en pixel art (arte propio). Cada arma se construye en una cuadrícula de
 * caracteres con rectángulos y polígonos, recibe un contorno automático y se rota en saltos de 15°
 * al dibujarla, como en los juegos de 16 bits. Todos miran a la derecha y giran sobre su empuñadura.
 */
import type { Ctx } from './pixel';

type Grid = string[][];

export const ART_PALETTE: Record<string, string> = {
  o: '#1b1f4a', // contorno
  S: '#f4f7ff', // acero brillante
  s: '#c9cfe3', // acero
  g: '#8e94b5', // acero en sombra
  G: '#565b80', // acero oscuro
  k: '#2a2d4f', // metal negro
  W: '#7a4e2a', // madera oscura
  w: '#b07a45', // madera
  p: '#ff2e63', // rosa
  P: '#b81e47', // rosa oscuro
  y: '#ffd23f', // oro
  Y: '#ff8a3c', // naranja
  l: '#9a8fd1', // lavanda
  L: '#d8d0fa', // lavanda clara
  c: '#fdf1d6', // crema
};

const grid = (w: number, h: number): Grid =>
  Array.from({ length: h }, () => Array<string>(w).fill('.'));

function R(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) if (g[j]?.[i] !== undefined) g[j]![i] = c;
}

function P(g: Grid, pts: [number, number][], c: string) {
  for (let y = 0; y < g.length; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]!;
      const [x2, y2] = pts[(i + 1) % pts.length]!;
      if ((y1 <= yc && yc < y2) || (y2 <= yc && yc < y1))
        xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.ceil(xs[i]! - 0.5); x <= Math.floor(xs[i + 1]! - 0.5); x++)
        if (g[y]![x] !== undefined) g[y]![x] = c;
  }
}

function disc(g: Grid, cx: number, cy: number, r: number, c: string) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0]!.length; x++)
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) g[y]![x] = c;
}

/** Contorno azul marino alrededor de todo lo dibujado. */
function outline(g: Grid): string[] {
  const out = g.map((r) => [...r]);
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0]!.length; x++) {
      if (g[y]![x] !== '.') continue;
      const n = [g[y - 1]?.[x], g[y + 1]?.[x], g[y]?.[x - 1], g[y]?.[x + 1]];
      if (n.some((c) => c !== undefined && c !== '.')) out[y]![x] = 'o';
    }
  return out.map((r) => r.join(''));
}

export interface Art {
  rows: string[];
  /** Punto de giro (la empuñadura). */
  px: number;
  py: number;
}

// ------------------------------------------------------------------ daga (peón) 36×13

function dagger(): Art {
  const g = grid(36, 13);
  R(g, 1, 5, 3, 3, 'y'); // pomo
  R(g, 4, 5, 8, 3, 'W'); // empuñadura
  for (const x of [5, 7, 9]) R(g, x, 5, 1, 3, 'w');
  R(g, 12, 2, 2, 9, 'p'); // guarda
  R(g, 14, 2, 1, 9, 'P');
  P(
    g,
    [
      [15, 4],
      [29, 4],
      [34, 6.5],
      [29, 9],
      [15, 9],
    ],
    's',
  ); // hoja
  R(g, 15, 4, 14, 1, 'S');
  R(g, 15, 8, 14, 1, 'g');
  R(g, 17, 6, 11, 1, 'g');
  R(g, 31, 6, 2, 1, 'S');
  return { rows: outline(g), px: 8, py: 6 };
}

// ------------------------------------------------------------------ lanza (caballo) 76×15 ×2 banderines

function lance(flap: 0 | 1): Art {
  const g = grid(76, 17);
  R(g, 1, 7, 54, 3, 'w'); // asta
  R(g, 1, 9, 54, 1, 'W');
  for (let x = 6; x < 54; x += 9) R(g, x, 7, 2, 3, 'W'); // vetas
  R(g, 1, 6, 4, 5, 'W'); // contera
  R(g, 22, 5, 5, 7, 'y'); // empuñadura dorada
  R(g, 22, 5, 5, 1, 'c');
  R(g, 22, 11, 5, 1, 'Y');
  P(
    g,
    [
      [55, 4],
      [62, 4],
      [74, 8.5],
      [62, 13],
      [55, 13],
    ],
    's',
  ); // punta
  R(g, 55, 4, 7, 1, 'S');
  R(g, 55, 12, 7, 1, 'g');
  R(g, 58, 8, 14, 1, 'g');
  R(g, 53, 3, 3, 11, 'y'); // collar
  // banderín (dos posiciones)
  if (flap) {
    P(
      g,
      [
        [51, 7],
        [40, 3],
        [30, 2],
        [34, 5],
        [28, 8],
        [40, 8.5],
      ],
      'p',
    );
    R(g, 42, 5, 8, 1, 'P');
  } else {
    P(
      g,
      [
        [51, 7],
        [40, 8],
        [30, 11],
        [34, 8],
        [28, 4],
        [40, 5.5],
      ],
      'p',
    );
    R(g, 42, 6, 8, 1, 'P');
  }
  return { rows: outline(g), px: 24, py: 8 };
}

// ------------------------------------------------------------------ bastón (alfil) 54×15

function staff(): Art {
  const g = grid(54, 15);
  R(g, 1, 6, 44, 3, 'w');
  R(g, 1, 8, 44, 1, 'W');
  for (const x of [8, 20, 34]) R(g, x, 5, 3, 5, 'y');
  P(
    g,
    [
      [44, 2],
      [52, 2],
      [48, 4],
      [46, 7.5],
      [48, 11],
      [52, 13],
      [44, 13],
    ],
    'l',
  ); // garras
  R(g, 44, 3, 4, 1, 'L');
  return { rows: outline(g), px: 6, py: 7 };
}

// ------------------------------------------------------------------ cañón (torre) 52×21

function cannon(): Art {
  const g = grid(52, 21);
  P(
    g,
    [
      [1, 5],
      [40, 3],
      [40, 17],
      [1, 15],
    ],
    'G',
  ); // tubo
  P(
    g,
    [
      [1, 5],
      [40, 3],
      [40, 6],
      [1, 8],
    ],
    'g',
  );
  R(g, 1, 6, 38, 1, 's');
  R(g, 8, 4, 3, 13, 'y'); // aros dorados
  R(g, 24, 3, 3, 15, 'y');
  R(g, 8, 4, 3, 1, 'c');
  R(g, 24, 3, 3, 1, 'c');
  R(g, 40, 1, 8, 18, 'k'); // boca
  R(g, 40, 1, 8, 3, 'G');
  R(g, 46, 5, 2, 10, 'o');
  disc(g, 4, 10, 4, 'k');
  disc(g, 4, 10, 2, 'y');
  return { rows: outline(g), px: 4, py: 10 };
}

// ------------------------------------------------------------------ sable (dama) 50×15

function saber(): Art {
  const g = grid(50, 15);
  R(g, 1, 6, 3, 4, 'p'); // pomo
  R(g, 4, 6, 8, 3, 'W');
  for (const x of [5, 7, 9]) R(g, x, 6, 1, 3, 'w');
  P(
    g,
    [
      [12, 2],
      [14, 2],
      [14, 13],
      [12, 13],
    ],
    'y',
  ); // guarda
  P(
    g,
    [
      [15, 5],
      [34, 3.5],
      [44, 3],
      [48, 4],
      [41, 8],
      [28, 10],
      [15, 10],
    ],
    's',
  ); // hoja curva
  P(
    g,
    [
      [15, 5],
      [34, 3.5],
      [44, 3],
      [48, 4],
      [34, 5],
      [15, 6.5],
    ],
    'S',
  );
  P(
    g,
    [
      [15, 9],
      [28, 9.5],
      [41, 8],
      [34, 9],
      [15, 10],
    ],
    'g',
  );
  return { rows: outline(g), px: 9, py: 7 };
}

// ------------------------------------------------------------------ escopeta (rey) 74×19

function shotgun(): Art {
  const g = grid(74, 19);
  P(
    g,
    [
      [1, 7],
      [18, 8],
      [18, 17],
      [4, 17],
      [1, 12],
    ],
    'w',
  ); // culata
  P(
    g,
    [
      [1, 7],
      [18, 8],
      [18, 10],
      [1, 9],
    ],
    'c',
  );
  R(g, 2, 14, 16, 2, 'W');
  R(g, 18, 5, 14, 9, 'k'); // cajón
  R(g, 18, 5, 14, 2, 'G');
  R(g, 21, 7, 8, 2, 'y');
  R(g, 20, 13, 9, 5, 'k'); // guardamonte
  R(g, 22, 14, 5, 3, '.');
  R(g, 24, 13, 1, 3, 'g'); // gatillo
  R(g, 32, 5, 40, 3, 'G'); // cañón superior
  R(g, 32, 5, 40, 1, 'S');
  R(g, 32, 8, 40, 3, 'g'); // cañón inferior
  R(g, 32, 10, 40, 1, 'G');
  R(g, 69, 4, 3, 8, 'k'); // boquilla
  R(g, 40, 11, 18, 4, 'w'); // guardamanos
  R(g, 40, 14, 18, 1, 'W');
  R(g, 40, 11, 18, 1, 'c');
  R(g, 62, 3, 2, 2, 'y'); // mira
  return { rows: outline(g), px: 10, py: 8 };
}

export const ARTS = {
  dagger,
  lance0: () => lance(0),
  lance1: () => lance(1),
  staff,
  cannon,
  saber,
  shotgun,
} as const;
export type ArtId = keyof typeof ARTS;

const cache = new Map<ArtId, { canvas: HTMLCanvasElement | null; art: Art }>();

function load(id: ArtId) {
  const hit = cache.get(id);
  if (hit) return hit;
  const art = ARTS[id]();
  let canvas: HTMLCanvasElement | null = null;
  try {
    const c = document.createElement('canvas');
    c.width = art.rows[0]!.length;
    c.height = art.rows.length;
    const g = c.getContext('2d');
    if (g) {
      art.rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const col = ART_PALETTE[ch];
          if (!col) return;
          g.fillStyle = col;
          g.fillRect(x, y, 1, 1);
        }),
      );
      canvas = c;
    }
  } catch {
    canvas = null;
  }
  const entry = { canvas, art };
  cache.set(id, entry);
  return entry;
}

/** Tamaño de un arma en píxeles. */
export const artSize = (id: ArtId) => {
  const { art } = load(id);
  return { w: art.rows[0]!.length, h: art.rows.length, px: art.px, py: art.py };
};

/**
 * Dibuja un arma con su empuñadura en (x, y) mirando hacia `angle` (radianes), con el giro
 * en saltos de 15° y reflejada para no quedar boca abajo.
 */
export function blit(g: Ctx, id: ArtId, x: number, y: number, angle: number, scale = 1) {
  const { canvas, art } = load(id);
  if (!canvas) return;
  const step = Math.PI / 12;
  const a = Math.round(angle / step) * step;
  g.save();
  g.imageSmoothingEnabled = false;
  g.translate(Math.round(x), Math.round(y));
  g.rotate(a);
  if (Math.cos(a) < -0.001) g.scale(1, -1);
  g.drawImage(
    canvas,
    -art.px * scale,
    -art.py * scale,
    canvas.width * scale,
    canvas.height * scale,
  );
  g.restore();
}

/** Ángulo (en la misma cuantización) que usa `blit`: sirve para calcular la punta del arma. */
export const snapAngle = (angle: number) => Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
