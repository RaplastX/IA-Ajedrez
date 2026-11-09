/**
 * Probabilidad de victoria y precisión, siguiendo las fórmulas públicas de Lichess
 * (lila, `WinPercent` y `AccuracyPercent`).
 */
import { scoreToCp, type Score } from '../engine/uci.js';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** % de victoria (0–100) para el bando cuyo punto de vista tiene `cp`. */
export function winPercentFromCp(cp: number): number {
  const c = clamp(cp, -1000, 1000);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

export function winPercent(score: Score): number {
  return winPercentFromCp(scoreToCp(score));
}

/** Precisión de una jugada (0–100) a partir de la caída de % de victoria del que mueve. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const drop = winBefore - winAfter;
  const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669 + 1; // +1 de incertidumbre
  return clamp(raw, 0, 100);
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function harmonicMean(values: number[]): number {
  if (values.length === 0) return 0;
  const safe = values.map((v) => Math.max(v, 0.0001));
  return safe.length / safe.reduce((a, b) => a + 1 / b, 0);
}

/**
 * Precisión de partida para un color. `whiteWinPercents` son los % de victoria de las blancas
 * en cada posición (incluida la inicial), así que tiene `jugadas + 1` elementos.
 * Combina media ponderada por volatilidad y media armónica (como Lichess).
 */
export function gameAccuracy(whiteWinPercents: number[], color: 'w' | 'b'): number | null {
  const moves = whiteWinPercents.length - 1;
  if (moves < 1) return null;
  const windowSize = clamp(Math.floor(moves / 10), 2, 8);
  const windows: number[][] = [];
  for (let i = 0; i < moves; i++) {
    const start = Math.max(0, Math.min(i - Math.floor(windowSize / 2), moves + 1 - windowSize));
    windows.push(whiteWinPercents.slice(start, start + windowSize));
  }
  const weights = windows.map((w) => clamp(standardDeviation(w), 0.5, 12));

  const accuracies: number[] = [];
  const accWeights: number[] = [];
  for (let i = 0; i < moves; i++) {
    const mover: 'w' | 'b' = i % 2 === 0 ? 'w' : 'b';
    if (mover !== color) continue;
    const before = whiteWinPercents[i]!;
    const after = whiteWinPercents[i + 1]!;
    const [b, a] = color === 'w' ? [before, after] : [100 - before, 100 - after];
    accuracies.push(moveAccuracy(b, a));
    accWeights.push(weights[i]!);
  }
  if (accuracies.length === 0) return null;
  const weightSum = accWeights.reduce((s, w) => s + w, 0);
  const weighted = accuracies.reduce((s, a, i) => s + a * accWeights[i]!, 0) / weightSum;
  return (weighted + harmonicMean(accuracies)) / 2;
}
