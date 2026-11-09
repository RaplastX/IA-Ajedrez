/** Puzzle del día y retos diarios, deterministas por fecha (iguales para todos los usuarios). */
import { hashString, mulberry32 } from '../util/random.js';
import { XP_REWARDS } from './xp.js';

export function dailyIndex(day: string, poolSize: number): number {
  if (poolSize <= 0) throw new Error('poolSize debe ser positivo');
  return hashString(`daily-puzzle:${day}`) % poolSize;
}

export type DailyCounterKey =
  | 'puzzlesSolved'
  | 'gamesPlayed'
  | 'lessonsCompleted'
  | 'openingReviews'
  | 'analysesRun'
  | 'endgamesCompleted';

export type DailyCounters = Partial<Record<DailyCounterKey, number>>;

export interface DailyChallenge {
  id: string;
  counter: DailyCounterKey;
  target: number;
  xp: number;
}

const POOL: Omit<DailyChallenge, 'id' | 'xp'>[] = [
  { counter: 'puzzlesSolved', target: 5 },
  { counter: 'puzzlesSolved', target: 10 },
  { counter: 'gamesPlayed', target: 1 },
  { counter: 'gamesPlayed', target: 2 },
  { counter: 'lessonsCompleted', target: 1 },
  { counter: 'openingReviews', target: 10 },
  { counter: 'analysesRun', target: 1 },
  { counter: 'endgamesCompleted', target: 1 },
];

export function dailyChallenges(day: string, count = 3): DailyChallenge[] {
  const random = mulberry32(hashString(`daily-challenges:${day}`));
  const indices = POOL.map((_, i) => i);
  // Fisher–Yates determinista; evita dos retos del mismo contador.
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  const chosen: DailyChallenge[] = [];
  const usedCounters = new Set<string>();
  for (const idx of indices) {
    const c = POOL[idx]!;
    if (usedCounters.has(c.counter)) continue;
    usedCounters.add(c.counter);
    chosen.push({ ...c, id: `${day}:${c.counter}:${c.target}`, xp: XP_REWARDS.dailyChallenge });
    if (chosen.length === count) break;
  }
  return chosen;
}

export function challengeProgress(challenge: DailyChallenge, counters: DailyCounters): number {
  return Math.min(1, (counters[challenge.counter] ?? 0) / challenge.target);
}
