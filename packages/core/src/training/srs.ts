/**
 * Repetición espaciada SM-2 (SuperMemo 2) para memorizar líneas de apertura.
 * Cada tarjeta es una posición del repertorio en la que el usuario debe encontrar la jugada.
 */

export interface SrsCard {
  id: string;
  ease: number;
  intervalDays: number;
  repetitions: number;
  /** Fecha ISO (día) en la que vuelve a tocar repasar. */
  due: string;
  lapses: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const toDay = (date: Date): string => date.toISOString().slice(0, 10);

export function newCard(id: string, today: Date = new Date()): SrsCard {
  return { id, ease: 2.5, intervalDays: 0, repetitions: 0, due: toDay(today), lapses: 0 };
}

/**
 * Calidad de respuesta 0–5: 5 perfecta, 4 con duda, 3 con esfuerzo, <3 fallo.
 * La app la deriva del acierto y del tiempo de respuesta.
 */
export function reviewCard(card: SrsCard, quality: number, today: Date = new Date()): SrsCard {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, intervalDays, repetitions, lapses } = card;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  const due = toDay(new Date(today.getTime() + intervalDays * DAY_MS));
  return { ...card, ease, intervalDays, repetitions, lapses, due };
}

export function isDue(card: SrsCard, today: Date = new Date()): boolean {
  return card.due <= toDay(today);
}

/** Calidad SM-2 a partir de acierto y tiempo (ms) de respuesta. */
export function qualityFromAnswer(correct: boolean, timeMs: number, hintsUsed = 0): number {
  if (!correct) return hintsUsed > 0 ? 1 : 2;
  if (hintsUsed > 0) return 3;
  if (timeMs < 5000) return 5;
  if (timeMs < 15000) return 4;
  return 3;
}
