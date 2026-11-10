/**
 * Partículas en pixel art (cuadrados duros, paleta limitada, física a pocos cuadros por segundo):
 *  - `captureBurst`: chispas amarillas y humo punteado al capturar.
 *  - `shatter`: fragmentos de la pieza capturada.
 *  - `confetti`: cuadraditos de colores para celebrar logros.
 * La física es una función pura (`stepParticle`) para poder testearla.
 */
import { C } from './pixel';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'smoke' | 'confetti' | 'ring' | 'shard' | 'dust';
  rotation: number;
  spin: number;
}

export const PALETTE = [C.cream, C.lav, C.pink, C.yellow, C.white];

/**
 * Avanza una partícula `dt` segundos. `gs` escala gravedad y crecimientos al tamaño del mundo
 * (1 = píxeles CSS; 0.27 = píxeles de juego del tablero). Devuelve false cuando debe desaparecer.
 */
export function stepParticle(p: Particle, dt: number, gs = 1): boolean {
  p.life += dt;
  if (p.life >= p.maxLife) return false;
  const gravity =
    { spark: 900, confetti: 260, smoke: -40, ring: 0, shard: 1300, dust: -20 }[p.kind] * gs;
  const drag = { spark: 1.1, confetti: 1.4, smoke: 2.2, ring: 0, shard: 0.6, dust: 4 }[p.kind];
  p.vx -= p.vx * drag * dt;
  p.vy -= p.vy * drag * dt;
  p.vy += gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rotation += p.spin * dt;
  if (p.kind === 'smoke' || p.kind === 'ring' || p.kind === 'dust') {
    p.size += (p.kind === 'ring' ? 220 : p.kind === 'dust' ? 18 : 26) * gs * dt;
  }
  return true;
}

const STEP = 1 / 18; // física a 18 cuadros por segundo: el movimiento "va a saltos"

function drawParticle(g: CanvasRenderingContext2D, p: Particle) {
  const t = p.life / p.maxLife;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const s = Math.max(1, Math.round(p.size));
  if (p.kind === 'ring') {
    if (t > 0.7) return;
    g.fillStyle = C.white;
    const n = Math.max(12, Math.round(p.size * 6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.fillRect(
        Math.round(p.x + Math.cos(a) * p.size),
        Math.round(p.y + Math.sin(a) * p.size),
        1,
        1,
      );
    }
    return;
  }
  if (p.kind === 'smoke' || p.kind === 'dust') {
    // humo punteado (tramado de ajedrez) que se vuelve más ralo al desvanecerse
    g.fillStyle = p.color;
    const r = Math.max(1, Math.round(p.size / 2));
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        if (i * i + j * j > r * r) continue;
        if ((x + i + y + j) % 2 !== 0) continue;
        if (t > 0.6 && (x + i) % 4 === 0) continue;
        g.fillRect(x + i, y + j, 1, 1);
      }
    }
    return;
  }
  if (p.kind === 'confetti') {
    g.fillStyle = p.color;
    const flip = Math.floor(p.rotation * 2) % 2 === 0;
    g.fillRect(x, y, flip ? s : Math.max(1, s / 2), flip ? Math.max(1, s / 2) : s);
    return;
  }
  // chispas y fragmentos: cuadraditos que parpadean al final de su vida
  if (t > 0.75 && Math.floor(p.life * 36) % 2 === 0) return;
  g.fillStyle = p.color;
  g.fillRect(x, y, s, s);
}

/**
 * Sistema de partículas sobre un canvas. Con `res` el canvas es de baja resolución (res×res) y las
 * coordenadas de las partículas están en píxeles de juego; sin `res` usa píxeles CSS.
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  private frame = 0;
  private last = 0;
  private acc = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly res = 0,
  ) {
    if (res) {
      canvas.width = res;
      canvas.height = res;
    }
  }

  add(particles: Particle[]) {
    this.particles.push(...particles);
    if (!this.frame) {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    this.acc += Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.res) {
      const rect = this.canvas.getBoundingClientRect();
      if (this.canvas.width !== Math.round(rect.width)) {
        this.canvas.width = Math.round(rect.width);
        this.canvas.height = Math.round(rect.height);
      }
    }
    const gs = this.res ? this.res / 480 : 1;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.particles = this.particles.filter((p) => stepParticle(p, STEP, gs));
    }
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.particles) drawParticle(g, p);
    this.frame = this.particles.length ? requestAnimationFrame(this.tick) : 0;
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.particles = [];
  }
}

const rand = (min: number, max: number, random: () => number) => min + (max - min) * random();
const pick = (random: () => number) => PALETTE[Math.floor(random() * PALETTE.length)]!;

/** Chispas y humo de una captura en (x, y). `scale` ≈ tamaño de casilla en las mismas unidades. */
export function captureBurst(
  x: number,
  y: number,
  scale: number,
  random: () => number = Math.random,
): Particle[] {
  const out: Particle[] = [
    {
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.4,
      size: scale * 0.15,
      color: C.white,
      kind: 'ring',
      rotation: 0,
      spin: 0,
    },
  ];
  for (let i = 0; i < 22; i++) {
    const angle = rand(0, Math.PI * 2, random);
    const speed = rand(scale * 2.5, scale * 7, random);
    out.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - scale * 2,
      life: 0,
      maxLife: rand(0.35, 0.75, random),
      size: random() < 0.3 ? 2 : 1,
      color: random() < 0.5 ? C.yellow : random() < 0.5 ? C.white : C.orange,
      kind: 'spark',
      rotation: 0,
      spin: 0,
    });
  }
  for (let i = 0; i < 5; i++) {
    out.push({
      x: x + rand(-scale * 0.2, scale * 0.2, random),
      y: y + rand(-scale * 0.2, scale * 0.2, random),
      vx: rand(-scale, scale, random),
      vy: rand(-scale * 1.5, -scale * 0.3, random),
      life: 0,
      maxLife: rand(0.6, 1.1, random),
      size: rand(scale * 0.15, scale * 0.3, random),
      color: C.smoke,
      kind: 'smoke',
      rotation: 0,
      spin: 0,
    });
  }
  return out;
}

/** Confeti de cuadraditos desde la parte superior de un área de `width` píxeles CSS. */
export function confetti(
  width: number,
  count = 90,
  random: () => number = Math.random,
): Particle[] {
  return Array.from({ length: count }, () => ({
    x: rand(0, width, random),
    y: rand(-60, -10, random),
    vx: rand(-80, 80, random),
    vy: rand(60, 260, random),
    life: 0,
    maxLife: rand(1.6, 2.6, random),
    size: Math.round(rand(5, 9, random) / 3) * 3,
    color: pick(random),
    kind: 'confetti' as const,
    rotation: rand(0, Math.PI, random),
    spin: rand(-8, 8, random),
  }));
}

/** Fragmentos de la pieza capturada que salen despedidos en la dirección del golpe. */
export function shatter(
  x: number,
  y: number,
  scale: number,
  dirX: number,
  dirY: number,
  count = 16,
  random: () => number = Math.random,
): Particle[] {
  const len = Math.hypot(dirX, dirY) || 1;
  return Array.from({ length: count }, () => {
    const angle = Math.atan2(dirY / len, dirX / len) + rand(-0.9, 0.9, random);
    const speed = rand(scale * 3, scale * 8, random);
    return {
      x: x + rand(-scale * 0.2, scale * 0.2, random),
      y: y + rand(-scale * 0.25, scale * 0.15, random),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - scale * 3,
      life: 0,
      maxLife: rand(0.5, 0.95, random),
      size: random() < 0.35 ? 2 : 1,
      color: random() < 0.5 ? C.cream : random() < 0.5 ? C.white : C.navy,
      kind: 'shard' as const,
      rotation: 0,
      spin: 0,
    };
  });
}

/** Nubecilla de polvo al aterrizar una pieza. */
export function dustPuff(
  x: number,
  y: number,
  scale: number,
  random: () => number = Math.random,
): Particle[] {
  return Array.from({ length: 6 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    return {
      x: x + side * scale * 0.15,
      y: y + scale * 0.32,
      vx: side * rand(scale * 0.8, scale * 2.2, random),
      vy: rand(-scale * 0.6, -scale * 0.1, random),
      life: 0,
      maxLife: rand(0.3, 0.5, random),
      size: rand(scale * 0.12, scale * 0.2, random),
      color: C.smoke,
      kind: 'dust' as const,
      rotation: 0,
      spin: 0,
    };
  });
}

/** Lanza una celebración global (la escucha <Celebration />). */
export function celebrate() {
  window.dispatchEvent(new CustomEvent('ia:celebrate'));
}
