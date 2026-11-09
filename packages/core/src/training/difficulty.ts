/**
 * Dificultad adaptativa como un problema de bandido multibrazo (aprendizaje por refuerzo).
 *
 * Cada "brazo" es un desplazamiento respecto al rating del usuario (p. ej. +100). Mantenemos
 * una distribución Beta del % de acierto de cada brazo y, con muestreo de Thompson, elegimos el
 * brazo cuyo acierto muestreado esté más cerca de la zona de aprendizaje objetivo (~70 %):
 * ejercicios ni triviales ni imposibles.
 */
import { sampleBeta } from '../util/random.js';

export const DIFFICULTY_ARMS = [-300, -150, 0, 150, 300] as const;
export type DifficultyArm = (typeof DIFFICULTY_ARMS)[number];

export interface ArmStats {
  successes: number;
  failures: number;
}

export type DifficultyModel = Record<string, ArmStats>;

export const TARGET_SUCCESS = 0.7;

/** Priors razonables: los brazos más difíciles empiezan con menos acierto esperado. */
export function createDifficultyModel(): DifficultyModel {
  const priors: Record<number, ArmStats> = {
    [-300]: { successes: 9, failures: 1 },
    [-150]: { successes: 8, failures: 2 },
    0: { successes: 6, failures: 4 },
    150: { successes: 4, failures: 6 },
    300: { successes: 2, failures: 8 },
  };
  return Object.fromEntries(DIFFICULTY_ARMS.map((arm) => [String(arm), { ...priors[arm]! }]));
}

export function chooseDifficultyArm(
  model: DifficultyModel,
  random: () => number = Math.random,
  target = TARGET_SUCCESS,
): DifficultyArm {
  let bestArm: DifficultyArm = 0;
  let bestDistance = Infinity;
  for (const arm of DIFFICULTY_ARMS) {
    const stats = model[String(arm)] ?? { successes: 1, failures: 1 };
    const p = sampleBeta(stats.successes + 1, stats.failures + 1, random);
    const distance = Math.abs(p - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestArm = arm;
    }
  }
  return bestArm;
}

/** Registra el resultado. `decay` < 1 olvida poco a poco lo antiguo (el usuario mejora). */
export function recordDifficultyResult(
  model: DifficultyModel,
  arm: DifficultyArm,
  solved: boolean,
  decay = 0.98,
): DifficultyModel {
  const next: DifficultyModel = {};
  for (const [key, stats] of Object.entries(model)) {
    next[key] = { successes: stats.successes * decay, failures: stats.failures * decay };
  }
  const stats = next[String(arm)] ?? { successes: 0, failures: 0 };
  if (solved) stats.successes += 1;
  else stats.failures += 1;
  next[String(arm)] = stats;
  return next;
}

export function expectedSuccess(model: DifficultyModel, arm: DifficultyArm): number {
  const s = model[String(arm)] ?? { successes: 1, failures: 1 };
  return (s.successes + 1) / (s.successes + s.failures + 2);
}
