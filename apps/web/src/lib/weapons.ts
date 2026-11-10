/**
 * Armas de cada pieza en pixel art (arte propio, inspirado en el estilo retro de juegos como
 * Shotgun King, sin usar ningún recurso suyo). Se dibujan en un canvas de 128×128 donde cada
 * casilla mide 16 píxeles de juego, con paleta limitada y contornos duros.
 *
 *   peón → daga · caballo → lanza · alfil → bastón mágico · torre → cañón · dama → sables · rey → escopeta
 *
 * `draw(g, p, a, b)` es puro: p ∈ [0,1] es el progreso (ya cuantizado a pocos cuadros por segundo),
 * a el atacante y b el objetivo, en píxeles de juego.
 */
import {
  burst,
  C,
  clamp01,
  disc,
  easeIn,
  easeOut,
  lerp,
  line,
  outlined,
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

export const UNIT = 16;

export interface WeaponSpec {
  id: WeaponId;
  ms: number;
  /** Fracción de la animación en la que se produce el impacto. */
  hit: number;
  /** Fuerza del temblor del tablero (píxeles de pantalla). */
  shake: number;
  /** Cuerpo a cuerpo: el atacante se lanza sobre el objetivo; si no, dispara desde su casilla. */
  melee: boolean;
  /** Color del destello que cubre el tablero al impactar. */
  flash: string;
  draw: (g: Ctx, p: number, a: Pt, b: Pt) => void;
}

const dir = (a: Pt, b: Pt) => {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { ux: (b.x - a.x) / d, uy: (b.y - a.y) / d, d };
};
const noise = (i: number, p: number) => {
  const v = Math.sin(i * 12.9898 + Math.floor(p * 30) * 78.233) * 43758.5453;
  return v - Math.floor(v) - 0.5;
};
const frame = (p: number, n = 2) => Math.floor(p * 40) % n;
const smoke = (g: Ctx, x: number, y: number, r: number, t: number) => {
  disc(g, x, y, r, C.smoke, t > 0.35);
  if (t < 0.35) disc(g, x, y, Math.max(0, r - 1.5), C.cream);
};

// ---------------------------------------------------------------- PEÓN · daga

function dagger(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy, d } = dir(a, b);
  const nx = -uy;
  const ny = ux;
  const pull = easeOut(seg(p, 0, 0.35));
  const thrust = easeIn(seg(p, 0.35, 0.55));
  const reach = lerp(-5 * pull, d - 4, thrust);
  const bx = a.x + ux * reach;
  const by = a.y + uy * reach;
  outlined(g, bx - ux * 4, by - uy * 4, bx, by, 2, C.wood); // empuñadura
  outlined(g, bx + nx * 3, by + ny * 3, bx - nx * 3, by - ny * 3, 2, C.pink); // guarda
  outlined(g, bx, by, bx + ux * 8, by + uy * 8, 2, C.steel); // hoja
  const k = seg(p, 0.55, 1);
  if (k > 0 && k < 0.75) {
    for (let i = -1; i <= 1; i++)
      line(
        g,
        b.x - 6 + i * 2,
        b.y - 7,
        b.x + 6 + i * 2,
        b.y + 5,
        k < 0.4 ? C.white : C.pink,
        1 + (k < 0.2 ? 1 : 0),
      );
    if (k < 0.3) burst(g, b.x, b.y, 8, C.yellow, 8, 0.4, 1);
  }
}

// ---------------------------------------------------------------- CABALLO · lanza

function lance(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy, d } = dir(a, b);
  const nx = -uy;
  const ny = ux;
  const aim = easeOut(seg(p, 0, 0.35));
  const charge = easeIn(seg(p, 0.35, 0.6));
  const broken = p > 0.6;
  const len = 22;
  const front = lerp(3, Math.max(3, d - len + 7), charge);
  const sx = a.x + ux * front;
  const sy = a.y + uy * front + (1 - charge) * Math.sin(p * 90) * 0.6 * aim;
  if (charge > 0 && !broken) {
    for (let i = -3; i <= 3; i++) {
      const o = i * 2.2;
      const x0 = a.x + ux * (front - 6 - (i & 1) * 4) + nx * o;
      const y0 = a.y + uy * (front - 6 - (i & 1) * 4) + ny * o;
      line(g, x0, y0, x0 - ux * 8, y0 - uy * 8, C.white, 1);
    }
  }
  if (!broken) {
    outlined(g, sx, sy, sx + ux * len, sy + uy * len, 2, C.wood);
    // banderín que ondea a saltos
    const fx = sx + ux * 6;
    const fy = sy + uy * 6;
    const flap = frame(p, 2) ? 2 : -1;
    outlined(g, fx, fy, fx - ux * 6 + nx * (3 + flap), fy - uy * 6 + ny * (3 + flap), 2, C.pink);
    outlined(
      g,
      sx + ux * (len - 5),
      sy + uy * (len - 5),
      sx + ux * (len + 1),
      sy + uy * (len + 1),
      3,
      C.steel,
    );
  } else {
    const k = seg(p, 0.6, 1);
    for (let i = 0; i < 8; i++) {
      const ang = Math.atan2(uy, ux) + Math.PI + noise(i, 0) * 3;
      const dist = 2 + k * (6 + (noise(i + 9, 0) + 0.5) * 8);
      const x = b.x + Math.cos(ang) * dist;
      const y = b.y + Math.sin(ang) * dist + k * k * 6;
      if (k < 0.85 || i % 2) rect(g, x, y, 3, 1, C.wood);
    }
  }
}

// ---------------------------------------------------------------- ALFIL · bastón mágico

function staff(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy } = dir(a, b);
  const charge = easeOut(seg(p, 0, 0.45));
  const beam = seg(p, 0.45, 0.9);
  const ox = a.x + ux * 9;
  const oy = a.y + uy * 9;
  outlined(g, a.x - ux * 3, a.y - uy * 3, ox, oy, 2, C.wood);
  const r = 1 + charge * 4 + (frame(p) ? 0 : 1);
  disc(g, ox, oy, r + 1, C.navy);
  disc(g, ox, oy, r, C.lav);
  disc(g, ox, oy, r * 0.5, C.white);
  for (let i = 0; i < 6; i++) {
    const ang = Math.floor(p * 14) * 0.5 + (i * Math.PI) / 3;
    rect(g, ox + Math.cos(ang) * (r + 4), oy + Math.sin(ang) * (r + 4), 1, 1, C.cream);
  }
  if (beam > 0 && beam < 1) {
    const reach = easeOut(clamp01(beam * 3));
    const ex = lerp(ox, b.x, reach);
    const ey = lerp(oy, b.y, reach);
    const w = 3 + (frame(p) ? 2 : 0);
    line(g, ox, oy, ex, ey, C.navy, w + 2);
    line(g, ox, oy, ex, ey, C.lav, w);
    line(g, ox, oy, ex, ey, C.white, Math.max(1, w - 2));
    // relámpago en zigzag
    let px = ox;
    let py = oy;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const nx = lerp(ox, ex, t) - uy * noise(i, p) * 9;
      const ny = lerp(oy, ey, t) + ux * noise(i, p) * 9;
      line(g, px, py, nx, ny, C.cream, 1);
      px = nx;
      py = ny;
    }
    if (beam > 0.15) burst(g, b.x, b.y, 9 * (1 - beam * 0.6), C.white, 8, Math.floor(p * 12), 1);
  }
}

// ---------------------------------------------------------------- TORRE · cañón

function cannon(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy } = dir(a, b);
  const nx = -uy;
  const ny = ux;
  const appear = p > 0.04;
  const recoil = p > 0.38 && p < 0.6 ? Math.max(0, 1 - seg(p, 0.4, 0.6)) * 4 : 0;
  const away = p > 0.78 && frame(p) === 0; // parpadea al desaparecer
  const mx = a.x + ux * 13;
  const my = a.y + uy * 13;
  if (appear && !away && p < 0.9) {
    const bx = a.x - ux * recoil;
    const by = a.y - uy * recoil;
    outlined(g, bx, by, bx + ux * 13, by + uy * 13, 4, C.gray);
    line(g, bx + nx * 1, by + ny * 1, bx + ux * 12 + nx * 1, by + uy * 12 + ny * 1, C.steel, 1);
    outlined(g, bx + ux * 12, by + uy * 12, bx + ux * 14, by + uy * 14, 6, C.navy);
    disc(g, bx, by, 4, C.navy);
    disc(g, bx, by, 2, C.gray);
    rect(g, bx, by, 1, 1, C.cream);
  }
  if (p > 0.38 && p < 0.5) {
    const big = p < 0.44;
    burst(g, mx, my, big ? 9 : 6, C.yellow, 10, ux * 3, 2);
    disc(g, mx, my, big ? 4 : 2, C.white);
  }
  if (p >= 0.4 && p < 0.66) {
    const k = seg(p, 0.4, 0.62);
    const arc = (kk: number) => ({
      x: lerp(mx, b.x, kk),
      y: lerp(my, b.y, kk) - Math.sin(kk * Math.PI) * 12,
    });
    for (let i = 4; i >= 1; i--) {
      const q = arc(Math.max(0, k - i * 0.06));
      smoke(g, q.x, q.y, 2 + i * 0.5, i / 4);
    }
    const q = arc(k);
    disc(g, q.x, q.y, 3, C.navy);
    rect(g, q.x - 1, q.y - 1, 1, 1, C.white);
  }
  const boom = seg(p, 0.62, 1);
  if (boom > 0) {
    const r = 3 + boom * 10;
    const dither = boom > 0.55;
    disc(g, b.x, b.y, r, C.pink, dither);
    disc(g, b.x, b.y, r * 0.75, C.orange, dither);
    disc(g, b.x, b.y, r * 0.5, C.yellow, dither);
    if (boom < 0.4) disc(g, b.x, b.y, r * 0.25, C.white);
    if (boom < 0.7) ring(g, b.x, b.y, r + 2, C.navy);
  }
}

// ---------------------------------------------------------------- DAMA · sables gemelos

function sabers(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy } = dir(a, b);
  const raise = easeOut(seg(p, 0, 0.25));
  if (p < 0.3) {
    const cx = a.x;
    const cy = a.y - 3 * raise;
    for (const sign of [-1, 1]) {
      const ang = Math.atan2(uy, ux) + sign * 0.9;
      outlined(
        g,
        cx - Math.cos(ang) * 3,
        cy - Math.sin(ang) * 3,
        cx + Math.cos(ang) * 11,
        cy + Math.sin(ang) * 11,
        2,
        C.steel,
      );
      outlined(
        g,
        cx - Math.sin(ang) * 2,
        cy + Math.cos(ang) * 2,
        cx + Math.sin(ang) * 2,
        cy - Math.cos(ang) * 2,
        2,
        C.pink,
      );
    }
  }
  const slash = (from: number, to: number, x0: number, y0: number, x1: number, y1: number) => {
    const k = seg(p, from, to);
    if (k <= 0) return;
    const fade = seg(p, to + 0.12, 0.95);
    if (fade > 0.6 && frame(p) === 0) return;
    const ex = lerp(x0, x1, easeOut(k));
    const ey = lerp(y0, y1, easeOut(k));
    line(g, x0, y0, ex, ey, C.pink, fade > 0.3 ? 3 : 5);
    line(g, x0, y0, ex, ey, C.white, fade > 0.3 ? 1 : 2);
  };
  const r = 10;
  slash(0.28, 0.42, b.x - r, b.y - r, b.x + r, b.y + r);
  slash(0.4, 0.54, b.x + r, b.y - r, b.x - r, b.y + r);
  if (p > 0.42 && p < 0.58) burst(g, b.x, b.y, 11, C.yellow, 8, 0.4, 1);
}

// ---------------------------------------------------------------- REY · escopeta

function shotgun(g: Ctx, p: number, a: Pt, b: Pt) {
  const { ux, uy } = dir(a, b);
  const nx = -uy;
  const ny = ux;
  const appear = p > 0.04;
  const pump = Math.sin(seg(p, 0.18, 0.34) * Math.PI) * 3;
  const kick = p > 0.38 && p < 0.62 ? Math.max(0, 1 - seg(p, 0.4, 0.62)) : 0;
  const gone = p > 0.8 && frame(p) === 0;
  const gx = a.x - ux * kick * 4;
  const gy = a.y - uy * kick * 4 - kick * 2;
  const muzzleX = gx + ux * 17;
  const muzzleY = gy + uy * 17;
  if (appear && !gone && p < 0.92) {
    outlined(g, gx - ux * 6, gy - uy * 6 + 1, gx, gy, 4, C.wood); // culata
    outlined(g, gx, gy - 1, gx + ux * 17, gy + uy * 17 - 1, 2, C.steel);
    outlined(g, gx + nx * 2, gy + ny * 2, gx + ux * 17 + nx * 2, gy + uy * 17 + ny * 2, 2, C.gray);
    outlined(
      g,
      gx + ux * (7 - pump),
      gy + uy * (7 - pump) + 2,
      gx + ux * (11 - pump),
      gy + uy * (11 - pump) + 2,
      3,
      C.wood,
    );
    rect(g, muzzleX, muzzleY - 3, 1, 1, C.yellow);
  }
  if (p > 0.38 && p < 0.48) {
    burst(g, muzzleX, muzzleY, p < 0.43 ? 11 : 7, C.yellow, 10, ux * 3, 2);
    disc(g, muzzleX, muzzleY, p < 0.43 ? 4 : 2, C.white);
  }
  const t = easeOut(seg(p, 0.4, 0.52));
  if (p > 0.4 && p < 0.56) {
    const dist = t * Math.hypot(b.x - muzzleX, b.y - muzzleY);
    for (let i = -3; i <= 3; i++) {
      const ang = Math.atan2(uy, ux) + i * 0.07 * t;
      const x = muzzleX + Math.cos(ang) * dist;
      const y = muzzleY + Math.sin(ang) * dist;
      line(g, x, y, x - Math.cos(ang) * 5, y - Math.sin(ang) * 5, C.yellow, 1);
      rect(g, x, y, 2, 2, C.white);
    }
  }
  const sm = seg(p, 0.42, 1);
  if (sm > 0) {
    for (let i = 0; i < 4; i++) {
      smoke(
        g,
        muzzleX + ux * (sm * 6 + i * 3),
        muzzleY - sm * 6 - i * 2 + (i - 1.5) * 2,
        2 + sm * 4,
        sm,
      );
    }
  }
  const h = seg(p, 0.5, 0.72);
  if (h > 0 && h < 1) burst(g, b.x, b.y, 4 + h * 8, h < 0.5 ? C.white : C.pink, 8, 0.3, 1);
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  p: { id: 'p', ms: 560, hit: 0.55, shake: 2, melee: true, flash: C.pink, draw: dagger },
  n: { id: 'n', ms: 700, hit: 0.6, shake: 3, melee: true, flash: C.yellow, draw: lance },
  b: { id: 'b', ms: 800, hit: 0.5, shake: 3, melee: false, flash: C.lav, draw: staff },
  r: { id: 'r', ms: 860, hit: 0.62, shake: 5, melee: false, flash: C.orange, draw: cannon },
  q: { id: 'q', ms: 700, hit: 0.42, shake: 4, melee: true, flash: C.pink, draw: sabers },
  k: { id: 'k', ms: 760, hit: 0.42, shake: 6, melee: false, flash: C.orange, draw: shotgun },
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
}

/** Cuadros por segundo de las animaciones: a saltos, como el pixel art clásico. */
const FPS = 14;

/** Reproduce animaciones en un canvas de baja resolución (con "hit-stop" en el impacto). */
export class WeaponStage {
  static readonly RES = 128;
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
      job.draw(g, pq);
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
