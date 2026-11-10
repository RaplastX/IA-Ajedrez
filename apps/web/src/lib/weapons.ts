/**
 * Armas de cada pieza en pixel art (arte propio, ver weaponArt.ts). Se dibujan en un canvas de
 * 256×256 donde cada casilla mide 32 píxeles de juego, con paleta limitada y contornos duros.
 *
 *   peón → daga · caballo → lanza · alfil → bastón mágico · torre → cañón · dama → sables · rey → escopeta
 *
 * `draw(g, p, a, b)` es puro: p ∈ [0,1] es el progreso (ya cuantizado a pocos cuadros por segundo),
 * a el atacante y b el objetivo, en píxeles de juego.
 */
import { blit, snapAngle } from './weaponArt';
import {
  zoom,
  C,
  clamp01,
  disc,
  easeIn,
  easeOut,
  lerp,
  line,
  rect,
  ring,
  seg,
  text,
  type Ctx,
} from './pixel';

export interface Pt {
  x: number;
  y: number;
}

export type WeaponId = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export const UNIT = 32;

export interface WeaponSpec {
  id: WeaponId;
  ms: number;
  /** Fracción de la animación en la que se produce el impacto. */
  hit: number;
  /** Fuerza del temblor del tablero (píxeles de pantalla). */
  shake: number;
  /** Cuerpo a cuerpo: el atacante se lanza sobre el objetivo; si no, dispara desde su casilla. */
  melee: boolean;
  /** Color del destello que acompaña al impacto. */
  flash: string;
  draw: (g: Ctx, p: number, a: Pt, b: Pt) => void;
}

const dir = (a: Pt, b: Pt) => {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { ux: (b.x - a.x) / d, uy: (b.y - a.y) / d, d, ang: Math.atan2(b.y - a.y, b.x - a.x) };
};
const noise = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v) - 0.5;
};
/** Índice de cuadro (a ~14 por segundo) para parpadeos y ondeos. */
const fidx = (p: number, ms: number) => Math.round((p * ms) / 70);

/** Estrella de cuatro puntas (destello de un golpe). */
function star(g: Ctx, x: number, y: number, r: number, color: string) {
  rect(g, x - r, y, r * 2 + 1, 1, color);
  rect(g, x, y - r, 1, r * 2 + 1, color);
  const d = Math.round(r * 0.55);
  for (let i = 1; i <= d; i++) {
    rect(g, x - i, y - i, 1, 1, color);
    rect(g, x + i, y - i, 1, 1, color);
    rect(g, x - i, y + i, 1, 1, color);
    rect(g, x + i, y + i, 1, 1, color);
  }
  rect(g, x - 1, y - 1, 3, 3, C.white);
}

/** El casillero golpeado parpadea en blanco: un destello local, no de toda la pantalla. */
function squareFlash(g: Ctx, b: Pt, k: number) {
  if (k <= 0 || k > 0.3) return;
  const s = UNIT;
  g.fillStyle = k < 0.12 ? C.white : C.cream;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      if (k >= 0.12 && (x + y) % 2) continue;
      g.fillRect(Math.round(b.x - s / 2) + x, Math.round(b.y - s / 2) + y, 1, 1);
    }
}

/** Onda de choque: anillo de píxeles que se expande y se vuelve punteado. */
function shock(g: Ctx, b: Pt, k: number, max: number, color: string = C.white) {
  if (k <= 0 || k >= 1) return;
  const r = 4 + easeOut(k) * max;
  const n = Math.round(r * 7);
  g.fillStyle = k > 0.6 ? C.smoke : color;
  for (let i = 0; i < n; i++) {
    if (k > 0.5 && i % 2) continue;
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r), 2, 2);
  }
}

/**
 * Tajo curvo: arco de circunferencia que pasa por `b`, más grueso en el centro. Se ve el tramo
 * entre `tail` y `head` (0..1) del arco, de modo que primero se dibuja y luego se desvanece.
 */
function slash(
  g: Ctx,
  b: Pt,
  phi: number,
  head: number,
  tail: number,
  width: number,
  color: string,
  R = 30,
) {
  if (head <= tail) return;
  const cx = b.x - Math.cos(phi) * R;
  const cy = b.y - Math.sin(phi) * R;
  const span = 1.0;
  const n = 40;
  g.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (t < tail || t > head) continue;
    const a = phi - span + t * span * 2;
    const th = Math.max(1, Math.round(width * Math.sin(Math.PI * t)));
    for (let k = 0; k < th; k++) {
      const rr = R - th / 2 + k;
      g.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 2, 2);
    }
  }
}

/** Humo punteado: disco de tramado que se aclara al envejecer. */
const puff = (g: Ctx, x: number, y: number, r: number, t: number) => {
  disc(g, x, y, r, C.smoke, t > 0.3);
  if (t < 0.3) disc(g, x, y, Math.max(1, r - 3), C.cream);
};

// ---------------------------------------------------------------- PEÓN · daga

const DAGGER_MS = 640;
function dagger(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy, d, ang } = dir(a, b);
  const pull = easeOut(seg(p, 0, 0.3));
  const thrust = easeIn(seg(p, 0.3, 0.5));
  const stuck = p >= 0.5;
  const reach = stuck ? d - 24 : lerp(-10 * pull, d - 24, thrust);
  const x = a.x + ux * reach;
  const y = a.y + uy * reach;
  const vanish = p > 0.8 && fidx(p, DAGGER_MS) % 2 === 0;
  if (p > 0.03 && !vanish) blit(g, 'dagger', x, y, ang);
  if (p > 0.18 && p < 0.3)
    star(g, x + ux * 34, y + uy * 34, 4 + (fidx(p, DAGGER_MS) % 2) * 2, C.white);
  if (thrust > 0 && !stuck) {
    for (let i = -1; i <= 1; i++) {
      const ox = -uy * i * 7;
      const oy = ux * i * 7;
      line(g, x + ox - ux * 8, y + oy - uy * 8, x + ox - ux * 22, y + oy - uy * 22, C.white, 1);
    }
  }
  const k = seg(p, 0.5, 1);
  squareFlash(g, b, k);
  slash(g, b, -0.6, easeOut(seg(k, 0, 0.3)), seg(k, 0.25, 0.7), 6, k < 0.22 ? C.white : C.pink, 26);
  slash(
    g,
    b,
    0.6 + Math.PI,
    easeOut(seg(k, 0.1, 0.4)),
    seg(k, 0.35, 0.8),
    6,
    k < 0.3 ? C.white : C.pink,
    26,
  );
  if (k > 0 && k < 0.35) star(g, b.x, b.y, 12 - k * 20, C.yellow);
}

// ---------------------------------------------------------------- CABALLO · lanza

const LANCE_MS = 780;
function lance(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy, d, ang } = dir(a, b);
  const px = -uy;
  const py = ux;
  const ready = easeOut(seg(p, 0, 0.3));
  const charge = easeIn(seg(p, 0.3, 0.6));
  const hitReach = d - 44;
  const front = lerp(lerp(-26, -8, ready), hitReach, charge);
  const wob = p < 0.3 ? Math.sin(p * 60) * 1.2 : 0;
  const x = a.x + ux * front + px * wob;
  const y = a.y + uy * front + py * wob;
  const flap = fidx(p, LANCE_MS) % 2 === 0 ? 'lance0' : 'lance1';
  if (p > 0.03 && p < 0.6) blit(g, flap, x, y, ang);
  if (charge > 0 && p < 0.6) {
    for (let i = -2; i <= 2; i++) {
      const o = i * 7;
      const back = 20 + (i & 1 ? 10 : 0) + (fidx(p, LANCE_MS) % 2) * 4;
      const sx = x + px * o - ux * back;
      const sy = y + py * o - uy * back;
      line(g, sx, sy, sx - ux * 16, sy - uy * 16, C.white, 1);
    }
  }
  const k = seg(p, 0.6, 1);
  squareFlash(g, b, k);
  shock(g, b, seg(k, 0, 0.7), 22);
  if (k > 0 && k < 0.4) star(g, b.x, b.y, 14 - k * 18, C.yellow);
  if (k > 0) {
    // la lanza se parte: astillas que saltan y caen
    for (let i = 0; i < 9; i++) {
      const sp = (noise(i, 1) + 0.5) * 1.4 - 0.7;
      const v = 20 + (noise(i, 2) + 0.5) * 34;
      const t = k;
      const sx = b.x - ux * 8 + Math.cos(ang + Math.PI + sp * 2.4) * v * easeOut(t);
      const sy = b.y - uy * 8 + Math.sin(ang + Math.PI + sp * 2.4) * v * easeOut(t) + t * t * 22;
      if (k > 0.8 && i % 2) continue;
      rect(g, sx, sy, 5, 2, C.wood);
      rect(g, sx, sy + 2, 5, 1, C.navy);
    }
    // el banderín cae flotando
    const fx = b.x - ux * 10 + k * 10;
    const fy = b.y - 6 + k * 26 + Math.sin(k * 12) * 2;
    if (k < 0.9) {
      rect(g, fx, fy, 9, 4, C.pink);
      rect(g, fx, fy + 4, 9, 1, C.navy);
    }
  }
}

// ---------------------------------------------------------------- ALFIL · bastón mágico

const STAFF_MS = 900;
function staff(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy, ang } = dir(a, b);
  const px = -uy;
  const py = ux;
  const rise = easeOut(seg(p, 0, 0.18));
  const fade = p > 0.88 && fidx(p, STAFF_MS) % 2 === 0;
  const hover = Math.round(Math.sin(p * 16) * 1.5);
  const bx = a.x + ux * 6 + px * hover;
  const by = a.y + uy * 6 + py * hover;
  const tipX = bx + ux * 44;
  const tipY = by + uy * 44;
  if (p > 0.03 && !fade) {
    blit(g, 'staff', bx + ux * (rise - 1) * 14, by + uy * (rise - 1) * 14, ang);
  }
  // orbe que se carga y vibra
  const charge = easeOut(seg(p, 0.1, 0.45));
  const beam = seg(p, 0.45, 0.88);
  const r = 3 + charge * 8 - (beam > 0 ? beam * 4 : 0) + (fidx(p, STAFF_MS) % 2);
  if (p > 0.1 && !fade) {
    disc(g, tipX, tipY, r + 2, C.navy);
    disc(g, tipX, tipY, r, C.lav);
    disc(g, tipX, tipY, r * 0.62, C.cream);
    rect(g, tipX - 1, tipY - 1, 2, 2, C.white);
    // chispas que giran alrededor del orbe
    for (let i = 0; i < 6; i++) {
      const s = fidx(p, STAFF_MS) * 0.55 + (i * Math.PI) / 3;
      const rr = r + 6 + (i % 2) * 3;
      rect(g, tipX + Math.cos(s) * rr, tipY + Math.sin(s) * rr, 2, 2, i % 2 ? C.cream : C.lav);
    }
  }
  if (beam > 0 && beam < 1) {
    const reach = easeOut(clamp01(beam * 3));
    const ex = lerp(tipX, b.x, reach);
    const ey = lerp(tipY, b.y, reach);
    const open = beam < 0.7 ? 1 : 1 - (beam - 0.7) / 0.3;
    const w = Math.max(1, Math.round((8 + (fidx(p, STAFF_MS) % 2) * 2) * open));
    line(g, tipX, tipY, ex, ey, C.navy, w + 4);
    line(g, tipX, tipY, ex, ey, C.lav, w + 2);
    line(g, tipX, tipY, ex, ey, C.cream, Math.max(1, w - 2));
    line(g, tipX, tipY, ex, ey, C.white, Math.max(1, w - 5));
    // dashes de energía que corren por el rayo y zigzag eléctrico
    const len = Math.hypot(ex - tipX, ey - tipY);
    for (let i = 0; i < 7; i++) {
      const t = ((i / 7 + fidx(p, STAFF_MS) * 0.17) % 1) * len;
      rect(
        g,
        tipX + ux * t - 1 + px * (i % 2 ? 4 : -4),
        tipY + uy * t - 1 + py * (i % 2 ? 4 : -4),
        2,
        2,
        C.white,
      );
    }
    let qx = tipX;
    let qy = tipY;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const nx2 = lerp(tipX, ex, t) + px * noise(i, fidx(p, STAFF_MS)) * 20;
      const ny2 = lerp(tipY, ey, t) + py * noise(i, fidx(p, STAFF_MS)) * 20;
      line(g, qx, qy, nx2, ny2, C.lav, 1);
      qx = nx2;
      qy = ny2;
    }
    if (reach > 0.9) {
      squareFlash(g, b, seg(beam, 0.3, 0.5));
      shock(g, b, seg(beam, 0.33, 0.95), 24, C.lav);
      star(g, b.x, b.y, 10 + (fidx(p, STAFF_MS) % 2) * 3, C.white);
    }
  }
}

// ---------------------------------------------------------------- TORRE · cañón

const CANNON_MS = 940;
function cannon(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy, ang } = dir(a, b);
  const recoil = p > 0.38 && p < 0.62 ? (1 - seg(p, 0.4, 0.62)) * 8 : 0;
  const away = p > 0.8 && fidx(p, CANNON_MS) % 2 === 0;
  const bx = a.x - ux * 6 - ux * recoil;
  const by = a.y - uy * 6 - uy * recoil;
  const mx = bx + ux * 44;
  const my = by + uy * 44;
  if (p > 0.04 && p < 0.9 && !away) blit(g, 'cannon', bx, by, ang);
  if (p > 0.38 && p < 0.52) {
    const big = p < 0.45;
    star(g, mx + ux * 4, my + uy * 4, big ? 16 : 9, C.yellow);
    disc(g, mx + ux * 4, my + uy * 4, big ? 8 : 4, C.white);
  }
  // bala en arco con estela de humo
  if (p >= 0.4 && p < 0.66) {
    const k = seg(p, 0.4, 0.64);
    const arc = (kk: number) => ({
      x: lerp(mx, b.x, kk),
      y: lerp(my, b.y, kk) - Math.sin(kk * Math.PI) * 30,
    });
    for (let i = 4; i >= 1; i--) {
      const q = arc(Math.max(0, k - i * 0.07));
      puff(g, q.x, q.y, 3 + i, i / 4);
    }
    const q = arc(k);
    disc(g, q.x, q.y, 6, C.navy);
    disc(g, q.x, q.y, 4, C.gray);
    rect(g, q.x - 2, q.y - 2, 2, 2, C.white);
  }
  const boom = seg(p, 0.64, 1);
  if (boom > 0) {
    squareFlash(g, b, seg(boom, 0, 0.3));
    const r = 8 + easeOut(boom) * 22;
    const dither = boom > 0.5;
    disc(g, b.x, b.y, r, C.pink, dither);
    disc(g, b.x, b.y, r * 0.78, C.orange, dither);
    disc(g, b.x, b.y, r * 0.52, C.yellow, dither);
    if (boom < 0.45) disc(g, b.x, b.y, r * 0.28, C.white);
    if (boom < 0.7) ring(g, b.x, b.y, r + 3, C.navy);
    // humo que sube
    for (let i = 0; i < 4; i++) {
      puff(g, b.x + (i - 1.5) * 9, b.y - 8 - boom * (18 + i * 6), 5 + boom * 5, boom);
    }
  }
}

// ---------------------------------------------------------------- DAMA · sables gemelos

const SABER_MS = 760;
function sabers(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ang } = dir(a, b);
  if (p > 0.03 && p < 0.34) {
    const lift = easeOut(seg(p, 0, 0.2));
    const open = 0.25 + (1 - lift) * 0.9;
    const spin = p > 0.2 ? (fidx(p, SABER_MS) % 2) * 0.26 : 0;
    blit(g, 'saber', a.x, a.y - 6 * lift, ang - open - spin);
    blit(g, 'saber', a.x, a.y - 6 * lift, ang + open + spin);
    if (p > 0.18) star(g, a.x + Math.cos(ang) * 30, a.y + Math.sin(ang) * 30 - 6, 5, C.white);
  }
  const k = seg(p, 0.34, 1);
  squareFlash(g, b, seg(p, 0.42, 0.6));
  slash(
    g,
    b,
    ang - 0.9,
    easeOut(seg(k, 0, 0.22)),
    seg(k, 0.2, 0.62),
    9,
    k < 0.18 ? C.white : C.pink,
    34,
  );
  slash(
    g,
    b,
    ang + 0.9 + Math.PI,
    easeOut(seg(k, 0.1, 0.32)),
    seg(k, 0.3, 0.72),
    9,
    k < 0.28 ? C.white : C.pink,
    34,
  );
  if (p > 0.42 && p < 0.6) star(g, b.x, b.y, 14 - (p - 0.42) * 40, C.yellow);
  if (k > 0.2 && k < 0.8) {
    for (let i = 0; i < 6; i++) {
      const aa = (i / 6) * Math.PI * 2 + 0.4;
      const rr = 12 + (k - 0.2) * 40;
      rect(g, b.x + Math.cos(aa) * rr, b.y + Math.sin(aa) * rr, 2, 2, C.cream);
    }
  }
}

// ---------------------------------------------------------------- REY · escopeta

const SHOTGUN_MS = 860;
function shotgun(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy, ang } = dir(a, b);
  const px = -uy;
  const py = ux;
  const kick = p > 0.4 && p < 0.62 ? 1 - seg(p, 0.42, 0.62) : 0;
  const pump = p > 0.14 && p < 0.34 ? Math.sin(seg(p, 0.14, 0.34) * Math.PI * 2) * 4 : 0;
  const gone = p > 0.82 && fidx(p, SHOTGUN_MS) % 2 === 0;
  const gx = a.x - ux * 10 - ux * kick * 12;
  const gy = a.y - uy * 10 - uy * kick * 12 - kick * 3;
  const aim = ang - (Math.cos(ang) >= 0 ? 1 : -1) * kick * 0.36;
  const mx = gx + Math.cos(snapAngle(aim)) * 62;
  const my = gy + Math.sin(snapAngle(aim)) * 62;
  if (p > 0.04 && p < 0.9 && !gone)
    blit(g, 'shotgun', gx + px * pump * 0.3, gy + py * pump * 0.3, aim);
  if (p > 0.4 && p < 0.52) {
    const big = p < 0.46;
    star(g, mx, my, big ? 18 : 9, C.yellow);
    disc(g, mx, my, big ? 9 : 4, C.white);
  }
  // perdigones: cinco puntos con estela, abanico que se abre
  const fly = easeOut(seg(p, 0.42, 0.5));
  if (p > 0.42 && p < 0.55) {
    const dist = fly * Math.hypot(b.x - mx, b.y - my);
    for (let i = -2; i <= 2; i++) {
      const aa = Math.atan2(b.y - my, b.x - mx) + i * 0.06 * fly;
      const x = mx + Math.cos(aa) * dist;
      const y = my + Math.sin(aa) * dist;
      line(g, x, y, x - Math.cos(aa) * 14, y - Math.sin(aa) * 14, C.yellow, 1);
      rect(g, x - 1, y - 1, 3, 3, C.white);
    }
  }
  // humo del cañón
  const sm = seg(p, 0.44, 1);
  if (sm > 0) {
    for (let i = 0; i < 4; i++) {
      puff(
        g,
        mx + ux * (6 + sm * 12 + i * 6) + px * (i - 1.5) * 3,
        my - sm * 14 - i * 5,
        3 + sm * 6,
        sm,
      );
    }
  }
  // impacto: cada perdigón deja su marca
  const h = seg(p, 0.5, 0.78);
  if (h > 0 && h < 1) {
    squareFlash(g, b, seg(p, 0.5, 0.62));
    for (let i = -2; i <= 2; i++) {
      const sx = b.x + px * i * 6 - ux * 4;
      const sy = b.y + py * i * 6 - uy * 4;
      star(g, sx, sy, h < 0.4 ? 5 : 3, h < 0.4 ? C.white : C.pink);
    }
  }
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  p: { id: 'p', ms: DAGGER_MS, hit: 0.5, shake: 2, melee: true, flash: C.pink, draw: dagger },
  n: { id: 'n', ms: LANCE_MS, hit: 0.6, shake: 3, melee: true, flash: C.yellow, draw: lance },
  b: { id: 'b', ms: STAFF_MS, hit: 0.5, shake: 3, melee: false, flash: C.lav, draw: staff },
  r: { id: 'r', ms: CANNON_MS, hit: 0.66, shake: 5, melee: false, flash: C.orange, draw: cannon },
  q: { id: 'q', ms: SABER_MS, hit: 0.44, shake: 4, melee: true, flash: C.pink, draw: sabers },
  k: { id: 'k', ms: SHOTGUN_MS, hit: 0.5, shake: 6, melee: false, flash: C.orange, draw: shotgun },
};

interface Job {
  ms: number;
  hit: number;
  elapsed: number;
  hitDone: boolean;
  freeze: number;
  draw: (g: Ctx, p: number) => void;
  onHit?: () => void;
  onDone?: () => void;
  zoom?: number;
}

/** Cuadros por segundo de las animaciones: a saltos, como el pixel art clásico. */
const FPS = 16;

/** Reproduce animaciones en un canvas de baja resolución (con "hit-stop" en el impacto). */
export class WeaponStage {
  static readonly RES = 256;
  private jobs: Job[] = [];
  private raf = 0;
  private last = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = WeaponStage.RES;
    canvas.height = WeaponStage.RES;
  }

  private add(job: Job) {
    this.jobs.push(job);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  play(spec: WeaponSpec, a: Pt, b: Pt, onHit: () => void, onDone: () => void = () => undefined) {
    this.add({
      ms: spec.ms,
      hit: spec.hit,
      elapsed: 0,
      hitDone: false,
      freeze: 0,
      draw: (g, p) => spec.draw(g, p, a, b),
      onHit,
      onDone,
    });
  }

  /** Texto flotante en fuente de píxeles (daño, "MATE"). */
  playText(str: string, at: Pt, scale: number, color: string, ms: number, rise = 6, blink = false) {
    this.add({
      ms,
      hit: 2,
      elapsed: 0,
      hitDone: true,
      freeze: 0,
      draw: (g, p) => {
        if (blink && Math.floor(p * 16) % 2 === 1 && p < 0.85) return;
        const y = at.y - Math.floor(easeOut(clamp01(p * 2.5)) * rise);
        text(g, str, at.x, y, scale, p > 0.8 && Math.floor(p * 20) % 2 ? C.cream : color);
      },
    });
  }

  private tick = (now: number) => {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    const dt = Math.min(50, now - this.last);
    this.last = now;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, WeaponStage.RES, WeaponStage.RES);
    const alive: Job[] = [];
    for (const job of this.jobs) {
      if (job.freeze > 0) job.freeze -= dt;
      else job.elapsed += dt;
      const p = Math.min(1, job.elapsed / job.ms);
      const steps = Math.max(6, Math.round((job.ms / 1000) * FPS));
      const pq = p >= 1 ? 1 : Math.floor(p * steps) / steps;
      g.save();
      zoom.k = job.zoom ?? 1;
      job.draw(g, pq);
      zoom.k = 1;
      g.restore();
      if (!job.hitDone && p >= job.hit) {
        job.hitDone = true;
        job.freeze = 80; // hit-stop
        job.onHit?.();
      }
      if (p >= 1) job.onDone?.();
      else alive.push(job);
    }
    this.jobs = alive;
    this.raf = alive.length ? requestAnimationFrame(this.tick) : 0;
    if (!alive.length) g.clearRect(0, 0, WeaponStage.RES, WeaponStage.RES);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.jobs = [];
  }
}
