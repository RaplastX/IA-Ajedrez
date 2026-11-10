/**
 * Piezas en pixel art de 16×16 dibujadas a mano (arte propio). Cada pieza tiene 6 cuadros:
 *   0 reposo · 1 aplastada · 2 parpadeo · 3 estirada/destello · 4 ataque · 5 daño
 * Las piezas simétricas se escriben como la mitad izquierda (8 columnas) y se reflejan.
 * Leyenda: o contorno · b cuerpo · h luz · s sombra · e ojo · a acento · y gema · w blanco · . vacío
 */

type Rows = string[];

const HALF: Record<string, Rows> = {
  // peón: cabeza redonda, cuello fino y base ancha (la más pequeña)
  p: [
    '........',
    '........',
    '........',
    '.....ooo',
    '....obbb',
    '...obbbb',
    '...obbbb',
    '...obebb',
    '...obbbb',
    '....obbb',
    '.....obb',
    '....obbb',
    '...obbbb',
    '..obbbbb',
    '..obbbbb',
    '..oooooo',
  ],
  // torre: almenas y torre recta
  r: [
    '........',
    '........',
    '..oo.oo.',
    '..ob.ob.',
    '..oooooo',
    '...obbbb',
    '...obebb',
    '...obbbb',
    '...obbbb',
    '...obbbb',
    '..oobbbb',
    '..obbbbb',
    '..obbbbb',
    '..obbbbb',
    '..obbbbb',
    '..oooooo',
  ],
  // alfil: mitra alta y puntiaguda con gema
  b: [
    '........',
    '.......y',
    '......ob',
    '.....obb',
    '....obbb',
    '...obbbb',
    '...obebb',
    '...obbbb',
    '....obbb',
    '.....obb',
    '....oooo',
    '...obbbb',
    '..obbbbb',
    '..obbbbb',
    '..obbbbb',
    '..oooooo',
  ],
  // dama: corona de seis puntas con gemas
  q: [
    '........',
    '.y..y..y',
    '.o..o..o',
    '.obobobb',
    '..obbbbb',
    '...obebb',
    '...obbbb',
    '....obbb',
    '.....obb',
    '....oooo',
    '...obbbb',
    '..obbbbb',
    '..obbbbb',
    '..obbbbb',
    '..obbbbb',
    '..oooooo',
  ],
  // rey: cruz dorada sobre la corona
  k: [
    '.......y',
    '.....yyy',
    '.......y',
    '....oooo',
    '...obbbb',
    '..obbbbb',
    '..obebbb',
    '..obbbbb',
    '...obbbb',
    '....oooo',
    '...obbbb',
    '..obbbbb',
    '..obbbbb',
    '..obbbbb',
    '..obbbbb',
    '..oooooo',
  ],
};

/** El caballo mira a la izquierda: se dibuja entero. */
const KNIGHT: Rows = [
  '.......oo.oo....',
  '......obboobo...',
  '.....obbbbbbbo..',
  '....obbbhhbbbbo.',
  '...obebbbhbbbbso',
  '..obbbbbbbbbbbso',
  '.obbbbbbbbbbbbso',
  '.obbbbbbbbbbbso.',
  'oobbbbbbbbbbso..',
  'obbsbbbbbbbso...',
  'oobbbbbbbbbo....',
  '.ooobbbbbbbo....',
  '...obbbbbbso....',
  '..obbbbbbbbso...',
  '.obbbbbbbbbbso..',
  '.oooooooooooooo.',
];

export const SIZE = 16;
export const FRAMES = 6;

/** Luz en el borde izquierdo y sombra en el derecho: así cada pieza se lee como un volumen. */
const rim = (row: string): string => {
  const c = [...row];
  const first = c.indexOf('o');
  if (first >= 0 && c[first + 1] === 'b') c[first + 1] = 'h';
  const last = c.lastIndexOf('o');
  if (last > 0 && c[last - 1] === 'b') c[last - 1] = 's';
  return c.join('');
};

const mirror = (half: Rows): Rows => half.map((r) => rim(r + [...r].reverse().join('')));

export const BASE: Record<string, Rows> = {
  p: mirror(HALF.p!),
  r: mirror(HALF.r!),
  b: mirror(HALF.b!),
  q: mirror(HALF.q!),
  k: mirror(HALF.k!),
  n: KNIGHT.map((r) => r.replace(/^([.o]*o)b/, '$1h')),
};

const BLANK = '.'.repeat(SIZE);
const map = (rows: Rows, fn: (c: string) => string): Rows =>
  rows.map((r) => [...r].map(fn).join(''));

/** Aplasta la pieza quitando una fila del cuerpo (el resto baja un píxel). */
const squash = (rows: Rows, at = 9): Rows => [BLANK, ...rows.filter((_, i) => i !== at)];
/** Estira la pieza duplicando una fila del cuerpo (si la fila superior está libre). */
const stretch = (rows: Rows, at = 8): Rows => {
  if (rows[0] !== BLANK) return rows;
  const out = [...rows];
  out.splice(at, 0, rows[at]!);
  return out.slice(1);
};

export function frames(type: string): Rows[] {
  const base = BASE[type]!;
  const blink = map(base, (c) => (c === 'e' ? 'o' : c));
  const hasGem = base.some((r) => r.includes('y'));
  const spark = hasGem ? map(base, (c) => (c === 'y' ? 'w' : c)) : stretch(base);
  const attack = map(stretch(base), (c) => (c === 'e' ? 'a' : c));
  const hurt = map(squash(base), (c) => (c === 'e' ? 'o' : 'bhs'.includes(c) ? 'w' : c));
  return [base, squash(base), blink, spark, attack, hurt];
}

export type Side = 'w' | 'b';

export const PALETTE: Record<Side, Record<string, string>> = {
  // blancas: crema con contorno azul marino
  w: {
    o: '#1b1f4a',
    b: '#fdf1d6',
    h: '#ffffff',
    s: '#b7b0e0',
    e: '#1b1f4a',
    a: '#ff2e63',
    y: '#ffd23f',
    w: '#ffffff',
  },
  // negras: azul pizarra con contorno casi negro y ojos rojos
  b: {
    o: '#0b0d24',
    b: '#4a4f9c',
    h: '#9a8fd1',
    s: '#2d3170',
    e: '#ff2e63',
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

/** Hoja con los 6 cuadros (96×16) para animar con CSS. */
export const sheetUrl = (type: string, side: Side) => render(type, side);
/** Un solo cuadro (reposo = 0, daño = 5) como imagen de 16×16. */
export const frameUrl = (type: string, side: Side, frame = 0) => render(type, side, frame);
