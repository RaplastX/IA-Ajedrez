/** Insignias (logros). Los textos se traducen en la interfaz con la clave `badges.<id>`. */

export interface PlayerStats {
  xp: number;
  puzzlesSolved: number;
  puzzlesAttempted: number;
  puzzleRating: number;
  bestPuzzleRating: number;
  gamesPlayed: number;
  gamesWon: number;
  bestAiEloBeaten: number;
  bestAccuracy: number;
  lessonsCompleted: number;
  openingReviews: number;
  endgamesCompleted: number;
  analysesRun: number;
  currentStreak: number;
  longestStreak: number;
  multiplayerGames: number;
  dailyChallengesCompleted: number;
}

export function emptyStats(): PlayerStats {
  return {
    xp: 0,
    puzzlesSolved: 0,
    puzzlesAttempted: 0,
    puzzleRating: 1500,
    bestPuzzleRating: 1500,
    gamesPlayed: 0,
    gamesWon: 0,
    bestAiEloBeaten: 0,
    bestAccuracy: 0,
    lessonsCompleted: 0,
    openingReviews: 0,
    endgamesCompleted: 0,
    analysesRun: 0,
    currentStreak: 0,
    longestStreak: 0,
    multiplayerGames: 0,
    dailyChallengesCompleted: 0,
  };
}

export interface BadgeDefinition {
  id: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
  earned: (s: PlayerStats) => boolean;
}

export const BADGES: readonly BadgeDefinition[] = [
  { id: 'firstPuzzle', icon: 'puzzle', tier: 'bronze', earned: (s) => s.puzzlesSolved >= 1 },
  { id: 'puzzles50', icon: 'puzzle', tier: 'silver', earned: (s) => s.puzzlesSolved >= 50 },
  { id: 'puzzles500', icon: 'puzzle', tier: 'gold', earned: (s) => s.puzzlesSolved >= 500 },
  { id: 'rating1600', icon: 'chart', tier: 'bronze', earned: (s) => s.bestPuzzleRating >= 1600 },
  { id: 'rating1900', icon: 'chart', tier: 'silver', earned: (s) => s.bestPuzzleRating >= 1900 },
  { id: 'rating2200', icon: 'chart', tier: 'gold', earned: (s) => s.bestPuzzleRating >= 2200 },
  { id: 'firstWin', icon: 'trophy', tier: 'bronze', earned: (s) => s.gamesWon >= 1 },
  { id: 'beat1200', icon: 'robot', tier: 'bronze', earned: (s) => s.bestAiEloBeaten >= 1200 },
  { id: 'beat1600', icon: 'robot', tier: 'silver', earned: (s) => s.bestAiEloBeaten >= 1600 },
  { id: 'beat2000', icon: 'robot', tier: 'gold', earned: (s) => s.bestAiEloBeaten >= 2000 },
  { id: 'accuracy90', icon: 'target', tier: 'silver', earned: (s) => s.bestAccuracy >= 90 },
  { id: 'streak3', icon: 'flame', tier: 'bronze', earned: (s) => s.longestStreak >= 3 },
  { id: 'streak7', icon: 'flame', tier: 'silver', earned: (s) => s.longestStreak >= 7 },
  { id: 'streak30', icon: 'flame', tier: 'gold', earned: (s) => s.longestStreak >= 30 },
  { id: 'scholar', icon: 'book', tier: 'silver', earned: (s) => s.lessonsCompleted >= 5 },
  { id: 'theorist', icon: 'book', tier: 'silver', earned: (s) => s.openingReviews >= 100 },
  { id: 'endgameTechnique', icon: 'king', tier: 'silver', earned: (s) => s.endgamesCompleted >= 5 },
  { id: 'analyst', icon: 'search', tier: 'bronze', earned: (s) => s.analysesRun >= 10 },
  { id: 'socialPlayer', icon: 'users', tier: 'bronze', earned: (s) => s.multiplayerGames >= 1 },
  { id: 'dailyHabit', icon: 'calendar', tier: 'silver', earned: (s) => s.dailyChallengesCompleted >= 10 },
];

/** Devuelve las insignias recién conseguidas (no incluidas en `alreadyEarned`). */
export function newlyEarnedBadges(stats: PlayerStats, alreadyEarned: Iterable<string>): string[] {
  const owned = new Set(alreadyEarned);
  return BADGES.filter((b) => !owned.has(b.id) && b.earned(stats)).map((b) => b.id);
}
