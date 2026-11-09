/** Generadores pseudoaleatorios deterministas (útiles para tests y para el puzzle del día). */

/** Hash FNV-1a de 32 bits. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** PRNG mulberry32: devuelve una función que produce números en [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Muestra de una normal estándar (Box–Muller). */
export function gaussian(random: () => number): number {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Muestra Gamma(k, 1) con el método de Marsaglia–Tsang. */
export function sampleGamma(shape: number, random: () => number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, random) * Math.pow(random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = gaussian(random);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = random();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Muestra Beta(α, β). */
export function sampleBeta(alpha: number, beta: number, random: () => number): number {
  const x = sampleGamma(alpha, random);
  const y = sampleGamma(beta, random);
  return x / (x + y);
}
