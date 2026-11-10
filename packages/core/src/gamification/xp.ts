/** Puntos de experiencia, niveles y rachas. */

export const XP_REWARDS = {
  puzzleSolved: 10,
  puzzleFailed: 2,
  lessonCompleted: 30,
  openingReview: 3,
  endgameCompleted: 25,
  analysisRun: 5,
  gamePlayed: 10,
  gameWonBase: 20,
  dailyChallenge: 50,
} as const;

/** Más XP por puzzles por encima del nivel del usuario (motiva a retarse). */
export function xpForPuzzle(solved: boolean, puzzleRating: number, userRating: number): number {
  if (!solved) return XP_REWARDS.puzzleFailed;
  const bonus = Math.max(0, Math.round((puzzleRating - userRating) / 50));
  return XP_REWARDS.puzzleSolved + Math.min(bonus, 10);
}

export function xpForGame(result: 'win' | 'draw' | 'loss', opponentElo: number): number {
  const base = XP_REWARDS.gamePlayed;
  if (result === 'loss') return base;
  const win = XP_REWARDS.gameWonBase + Math.round(opponentElo / 100);
  return base + (result === 'win' ? win : Math.round(win / 2));
}

/** XP total necesaria para alcanzar el nivel `level` (nivel 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1;
  return 50 * n * (n + 1);
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNext: next - floor,
    progress: (xp - floor) / (next - floor),
  };
}

/** Títulos por tramo de nivel; las claves se traducen en la interfaz. */
export function rankTitle(level: number): string {
  if (level >= 40) return 'grandmaster';
  if (level >= 30) return 'master';
  if (level >= 20) return 'expert';
  if (level >= 12) return 'advanced';
  if (level >= 6) return 'intermediate';
  return 'beginner';
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDay: string | null;
}

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Registra actividad en `today` (YYYY-MM-DD) y devuelve la racha actualizada. */
export function touchStreak(streak: Streak, today: string): Streak {
  if (!streak.lastActiveDay)
    return { current: 1, longest: Math.max(1, streak.longest), lastActiveDay: today };
  const diff = dayDiff(streak.lastActiveDay, today);
  if (diff <= 0) return streak;
  const current = diff === 1 ? streak.current + 1 : 1;
  return { current, longest: Math.max(streak.longest, current), lastActiveDay: today };
}
