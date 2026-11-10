/**
 * Clasificación de jugadas por la caída de % de victoria del bando que mueve.
 * Umbrales equivalentes a los de Lichess (0.1 / 0.2 / 0.3 en escala [-1, 1]).
 */

export type MoveClass =
  'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const MOVE_CLASSES: readonly MoveClass[] = [
  'book',
  'best',
  'excellent',
  'good',
  'inaccuracy',
  'mistake',
  'blunder',
];

export interface ClassifyInput {
  /** % de victoria del que mueve antes de la jugada (0–100). */
  winBefore: number;
  /** % de victoria del que mueve después de la jugada (0–100). */
  winAfter: number;
  playedUci: string;
  bestUci?: string;
  isBook?: boolean;
}

export function classifyMove({
  winBefore,
  winAfter,
  playedUci,
  bestUci,
  isBook,
}: ClassifyInput): MoveClass {
  if (isBook) return 'book';
  const drop = Math.max(0, winBefore - winAfter);
  if (bestUci && playedUci === bestUci) return 'best';
  if (drop < 2) return 'excellent';
  if (drop < 5) return 'good';
  if (drop < 10) return 'inaccuracy';
  if (drop < 15) return 'mistake';
  return 'blunder';
}

/** Jugadas que cuentan como error a la hora de detectar debilidades y generar ejercicios. */
export function isError(c: MoveClass): boolean {
  return c === 'inaccuracy' || c === 'mistake' || c === 'blunder';
}
