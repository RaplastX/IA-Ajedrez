/**
 * Efectos de partículas por código (Canvas 2D), sin dependencias ni assets:
 *  - `captureBurst`: chispas plateadas, humo y un destello circular al capturar una pieza.
 *  - `confetti`: lluvia de confeti cromado para celebrar logros.
 * La física es una función pura (`stepParticle`) para poder testearla.
 */

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

/** Paleta cromada del logo: blancos, platas y grafitos. */
export const CHROME = ['#ffffff', '#eef2f7', '#cfd5de', '#a9b1bc', '#7d8590'];

/** Avanza una partícula `dt` segundos. Devuelve false cuando debe desaparecer. */
export function stepParticle(p: Particle, dt: number): boolean {
  p.life += dt;
  if (p.life >= p.maxLife) return false;
  const gravity = { spark: 900, confetti: 260, smoke: -40, ring: 0, shard: 1300, dust: -20 }[
    p.kind
  ];
  const drag = { spark: 1.1, confetti: 1.4, smoke: 2.2, ring: 0, shard: 0.6, dust: 4 }[p.kind];
  p.vx -= p.vx * drag * dt;
  p.vy -= p.vy * drag * dt;
  p.vy += gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rotation += p.spin * dt;
  if (p.kind === 'smoke' || p.kind === 'ring' || p.kind === 'dust')
    p.size += (p.kind === 'ring' ? 220 : p.kind === 'dust' ? 18 : 26) * dt;
  return true;
}

function draw(ctx: CanvasRenderingContext2D, p: Particle) {
  const t = p.life / p.maxLife;
  const alpha = p.kind === 'confetti' ? Math.min(1, (1 - t) * 3) : 1 - t;
  ctx.globalAlpha = Math.max(0, alpha);
  if (p.kind === 'ring') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3 * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (p.kind === 'confetti') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
    return;
  }
  if (p.kind === 'shard') {
    // Fragmento metálico triangular que gira y refleja la luz.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.lineTo(p.size * 0.7, p.size * 0.6);
    ctx.lineTo(-p.size * 0.6, p.size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  if (p.kind === 'spark') {
    // Estela: un segmento en la dirección de la velocidad.
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    ctx.stroke();
    return;
  }
  const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
  gradient.addColorStop(0, p.color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

/** Sistema de partículas ligado a un canvas; se detiene solo cuando no quedan partículas. */
export class ParticleSystem {
  private particles: Particle[] = [];
  private frame = 0;
  private last = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  private resize() {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (this.canvas.width !== Math.round(width * ratio)) {
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
    }
    return ratio;
  }

  add(particles: Particle[]) {
    this.particles.push(...particles);
    if (!this.frame) {
      this.last = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ratio = this.resize();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    this.particles = this.particles.filter((p) => stepParticle(p, dt));
    for (const p of this.particles) draw(ctx, p);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.frame = this.particles.length ? requestAnimationFrame(this.tick) : 0;
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.particles = [];
  }
}

const rand = (min: number, max: number, random: () => number) => min + (max - min) * random();

/** Partículas de una captura en (x, y) (píxeles CSS). `scale` ≈ tamaño de casilla. */
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
      maxLife: 0.45,
      size: scale * 0.2,
      color: '#ffffff',
      kind: 'ring',
      rotation: 0,
      spin: 0,
    },
  ];
  for (let i = 0; i < 26; i++) {
    const angle = rand(0, Math.PI * 2, random);
    const speed = rand(scale * 2.5, scale * 7, random);
    out.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - scale * 2,
      life: 0,
      maxLife: rand(0.35, 0.75, random),
      size: rand(1.2, 2.6, random),
      color: CHROME[Math.floor(random() * CHROME.length)]!,
      kind: 'spark',
      rotation: 0,
      spin: 0,
    });
  }
  for (let i = 0; i < 7; i++) {
    out.push({
      x: x + rand(-scale * 0.2, scale * 0.2, random),
      y: y + rand(-scale * 0.2, scale * 0.2, random),
      vx: rand(-scale, scale, random),
      vy: rand(-scale * 1.5, -scale * 0.3, random),
      life: 0,
      maxLife: rand(0.6, 1.1, random),
      size: rand(scale * 0.15, scale * 0.3, random),
      color: 'rgba(150,140,130,0.35)',
      kind: 'smoke',
      rotation: 0,
      spin: 0,
    });
  }
  return out;
}

/** Confeti desde la parte superior de un área de `width` píxeles. */
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
    size: rand(7, 12, random),
    color: CHROME[Math.floor(random() * CHROME.length)]!,
    kind: 'confetti' as const,
    rotation: rand(0, Math.PI, random),
    spin: rand(-8, 8, random),
  }));
}

/** Lanza una celebración global (la escucha <Celebration />). */
export function celebrate() {
  window.dispatchEvent(new CustomEvent('ia:celebrate'));
}

/** Fragmentos de "cristal cromado" que salen despedidos en la dirección del golpe. */
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
    const spread = rand(-0.9, 0.9, random);
    const angle = Math.atan2(dirY / len, dirX / len) + spread;
    const speed = rand(scale * 3, scale * 8, random);
    return {
      x: x + rand(-scale * 0.2, scale * 0.2, random),
      y: y + rand(-scale * 0.25, scale * 0.15, random),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - scale * 3,
      life: 0,
      maxLife: rand(0.5, 0.95, random),
      size: rand(scale * 0.05, scale * 0.12, random),
      color: CHROME[Math.floor(random() * CHROME.length)]!,
      kind: 'shard' as const,
      rotation: rand(0, Math.PI * 2, random),
      spin: rand(-14, 14, random),
    };
  });
}

/** Nubecilla de polvo al aterrizar una pieza tras su salto. */
export function dustPuff(
  x: number,
  y: number,
  scale: number,
  random: () => number = Math.random,
): Particle[] {
  return Array.from({ length: 8 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    return {
      x: x + side * scale * 0.15,
      y: y + scale * 0.32,
      vx: side * rand(scale * 0.8, scale * 2.2, random),
      vy: rand(-scale * 0.6, -scale * 0.1, random),
      life: 0,
      maxLife: rand(0.35, 0.6, random),
      size: rand(scale * 0.05, scale * 0.1, random),
      color: 'rgba(200,205,215,0.28)',
      kind: 'dust' as const,
      rotation: 0,
      spin: 0,
    };
  });
}
