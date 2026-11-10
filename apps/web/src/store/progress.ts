/**
 * Progreso del usuario, "local-first": todo se guarda en el dispositivo y, si hay sesión,
 * se sincroniza con la API. Las transiciones son funciones puras (`apply*`) para poder testearlas.
 */
import {
  challengeProgress,
  createDifficultyModel,
  dailyChallenges,
  DEFAULT_RATING,
  emptyStats,
  newCard,
  newlyEarnedBadges,
  recordDifficultyResult,
  recordThemeResult,
  reviewCard,
  touchStreak,
  updatePuzzleRating,
  xpForGame,
  xpForPuzzle,
  XP_REWARDS,
  type DailyCounterKey,
  type DailyCounters,
  type DifficultyArm,
  type DifficultyModel,
  type GamePhase,
  type PlayerStats,
  type Puzzle,
  type Rating,
  type SrsCard,
  type Streak,
  type ThemeStatsMap,
} from '@ia-ajedrez/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage, today, uid } from '../lib/storage';

export interface GameRecord {
  id: string;
  date: string;
  mode: 'ai' | 'online' | 'import';
  pgn: string;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  playerColor: 'w' | 'b';
  opponent: string;
  opponentElo?: number;
  accuracy?: number;
}

export interface ProgressData {
  stats: PlayerStats;
  puzzleRating: Rating;
  ratingHistory: { date: string; rating: number }[];
  accuracyHistory: { date: string; accuracy: number }[];
  themeStats: ThemeStatsMap;
  phaseErrors: Record<GamePhase, number>;
  difficulty: DifficultyModel;
  srsCards: Record<string, SrsCard>;
  badges: Record<string, string>;
  streak: Streak;
  daily: { day: string; counters: DailyCounters; completed: string[] };
  seenPuzzles: string[];
  games: GameRecord[];
  completedLessons: string[];
  completedEndgames: string[];
  /** Ejercicios generados a partir de los errores del usuario en sus partidas. */
  personalPuzzles: Puzzle[];
  updatedAt: string;
}

export interface ActivityOutcome {
  xp: number;
  badges: string[];
  challenges: string[];
}

export function initialProgress(): ProgressData {
  return {
    stats: emptyStats(),
    puzzleRating: { ...DEFAULT_RATING },
    ratingHistory: [],
    accuracyHistory: [],
    themeStats: {},
    phaseErrors: { opening: 0, middlegame: 0, endgame: 0 },
    difficulty: createDifficultyModel(),
    srsCards: {},
    badges: {},
    streak: { current: 0, longest: 0, lastActiveDay: null },
    daily: { day: today(), counters: {}, completed: [] },
    seenPuzzles: [],
    games: [],
    completedLessons: [],
    completedEndgames: [],
    personalPuzzles: [],
    updatedAt: new Date(0).toISOString(),
  };
}

const cap = <T>(list: T[], max: number) =>
  list.length > max ? list.slice(list.length - max) : list;

/**
 * Aplica XP, racha, contadores y retos diarios e insignias. Todas las acciones pasan por aquí.
 */
export function applyActivity(
  data: ProgressData,
  xp: number,
  counter: DailyCounterKey | null,
  day: string = today(),
): { data: ProgressData; outcome: ActivityOutcome } {
  const streak = touchStreak(data.streak, day);
  const daily = data.daily.day === day ? { ...data.daily } : { day, counters: {}, completed: [] };
  daily.counters = { ...daily.counters };
  if (counter) daily.counters[counter] = (daily.counters[counter] ?? 0) + 1;

  let totalXp = xp;
  const finished: string[] = [];
  for (const challenge of dailyChallenges(day)) {
    if (daily.completed.includes(challenge.id)) continue;
    if (challengeProgress(challenge, daily.counters) >= 1) {
      finished.push(challenge.id);
      totalXp += challenge.xp;
    }
  }
  daily.completed = [...daily.completed, ...finished];

  const stats: PlayerStats = {
    ...data.stats,
    xp: data.stats.xp + totalXp,
    currentStreak: streak.current,
    longestStreak: Math.max(data.stats.longestStreak, streak.longest),
    dailyChallengesCompleted: data.stats.dailyChallengesCompleted + finished.length,
  };
  const earned = newlyEarnedBadges(stats, Object.keys(data.badges));
  const badges = { ...data.badges };
  for (const id of earned) badges[id] = day;

  return {
    data: { ...data, stats, streak, daily, badges, updatedAt: new Date().toISOString() },
    outcome: { xp: totalXp, badges: earned, challenges: finished },
  };
}

export function applyPuzzle(
  data: ProgressData,
  puzzle: Puzzle,
  solved: boolean,
  arm: DifficultyArm,
  serverRating?: Rating,
  day = today(),
) {
  const before = data.puzzleRating.rating;
  const puzzleRating = serverRating ?? updatePuzzleRating(data.puzzleRating, puzzle.rating, solved);
  const stats: PlayerStats = {
    ...data.stats,
    puzzlesAttempted: data.stats.puzzlesAttempted + 1,
    puzzlesSolved: data.stats.puzzlesSolved + (solved ? 1 : 0),
    puzzleRating: Math.round(puzzleRating.rating),
    bestPuzzleRating: Math.max(data.stats.bestPuzzleRating, Math.round(puzzleRating.rating)),
  };
  const next: ProgressData = {
    ...data,
    stats,
    puzzleRating,
    ratingHistory: cap(
      [
        ...data.ratingHistory,
        { date: new Date().toISOString(), rating: Math.round(puzzleRating.rating) },
      ],
      500,
    ),
    themeStats: recordThemeResult(data.themeStats, puzzle.themes, solved),
    difficulty: recordDifficultyResult(data.difficulty, arm, solved),
    seenPuzzles: cap([...data.seenPuzzles, puzzle.id], 400),
  };
  return applyActivity(
    next,
    xpForPuzzle(solved, puzzle.rating, before),
    solved ? 'puzzlesSolved' : null,
    day,
  );
}

export function applyGame(data: ProgressData, record: GameRecord, day = today()) {
  const won =
    (record.result === '1-0' && record.playerColor === 'w') ||
    (record.result === '0-1' && record.playerColor === 'b');
  const drawn = record.result === '1/2-1/2';
  const stats: PlayerStats = {
    ...data.stats,
    gamesPlayed: data.stats.gamesPlayed + 1,
    gamesWon: data.stats.gamesWon + (won ? 1 : 0),
    multiplayerGames: data.stats.multiplayerGames + (record.mode === 'online' ? 1 : 0),
    bestAiEloBeaten:
      won && record.mode === 'ai' && record.opponentElo
        ? Math.max(data.stats.bestAiEloBeaten, record.opponentElo)
        : data.stats.bestAiEloBeaten,
  };
  const xp = xpForGame(won ? 'win' : drawn ? 'draw' : 'loss', record.opponentElo ?? 1200);
  return applyActivity(
    { ...data, stats, games: cap([...data.games, record], 50) },
    xp,
    'gamesPlayed',
    day,
  );
}

export function applyAnalysis(
  data: ProgressData,
  accuracy: number | null,
  phaseErrors: Record<GamePhase, number>,
  gameId?: string,
  day = today(),
) {
  const stats: PlayerStats = {
    ...data.stats,
    analysesRun: data.stats.analysesRun + 1,
    bestAccuracy: Math.max(data.stats.bestAccuracy, Math.round(accuracy ?? 0)),
  };
  const next: ProgressData = {
    ...data,
    stats,
    phaseErrors: {
      opening: data.phaseErrors.opening + phaseErrors.opening,
      middlegame: data.phaseErrors.middlegame + phaseErrors.middlegame,
      endgame: data.phaseErrors.endgame + phaseErrors.endgame,
    },
    accuracyHistory:
      accuracy === null
        ? data.accuracyHistory
        : cap([...data.accuracyHistory, { date: new Date().toISOString(), accuracy }], 200),
    games: gameId
      ? data.games.map((g) => (g.id === gameId && accuracy !== null ? { ...g, accuracy } : g))
      : data.games,
  };
  return applyActivity(next, XP_REWARDS.analysisRun, 'analysesRun', day);
}

export function applyOpeningReview(
  data: ProgressData,
  cardId: string,
  quality: number,
  day = today(),
) {
  const card = data.srsCards[cardId] ?? newCard(cardId);
  const next: ProgressData = {
    ...data,
    srsCards: { ...data.srsCards, [cardId]: reviewCard(card, quality) },
    stats: { ...data.stats, openingReviews: data.stats.openingReviews + 1 },
  };
  return applyActivity(next, XP_REWARDS.openingReview, 'openingReviews', day);
}

export function applyLesson(data: ProgressData, lessonId: string, day = today()) {
  if (data.completedLessons.includes(lessonId)) return applyActivity(data, 5, null, day);
  const next: ProgressData = {
    ...data,
    completedLessons: [...data.completedLessons, lessonId],
    stats: { ...data.stats, lessonsCompleted: data.stats.lessonsCompleted + 1 },
  };
  return applyActivity(next, XP_REWARDS.lessonCompleted, 'lessonsCompleted', day);
}

export function applyEndgame(data: ProgressData, drillId: string, day = today()) {
  const first = !data.completedEndgames.includes(drillId);
  const next: ProgressData = {
    ...data,
    completedEndgames: first ? [...data.completedEndgames, drillId] : data.completedEndgames,
    stats: { ...data.stats, endgamesCompleted: data.stats.endgamesCompleted + (first ? 1 : 0) },
  };
  return applyActivity(next, first ? XP_REWARDS.endgameCompleted : 5, 'endgamesCompleted', day);
}

/** Nueva tarea (toast) para mostrar al usuario lo conseguido. */
export interface Toast {
  id: string;
  kind: 'xp' | 'badge' | 'challenge' | 'error' | 'info';
  text: string;
  params?: Record<string, string | number>;
}

interface ProgressStore extends ProgressData {
  toasts: Toast[];
  dismissToast: (id: string) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  recordPuzzle: (
    puzzle: Puzzle,
    solved: boolean,
    arm: DifficultyArm,
    serverRating?: Rating,
  ) => ActivityOutcome;
  recordGame: (record: GameRecord) => ActivityOutcome;
  recordAnalysis: (
    accuracy: number | null,
    phaseErrors: Record<GamePhase, number>,
    gameId?: string,
  ) => ActivityOutcome;
  recordOpeningReview: (cardId: string, quality: number) => ActivityOutcome;
  recordLesson: (lessonId: string) => ActivityOutcome;
  recordEndgame: (drillId: string) => ActivityOutcome;
  addPersonalPuzzles: (puzzles: Puzzle[]) => number;
  removePersonalPuzzle: (id: string) => void;
  importSnapshot: (data: Partial<ProgressData>) => void;
  reset: () => void;
}

const DATA_KEYS = Object.keys(initialProgress()) as (keyof ProgressData)[];

export const pickData = (state: ProgressData): ProgressData =>
  Object.fromEntries(DATA_KEYS.map((k) => [k, state[k]])) as unknown as ProgressData;

export const useProgress = create<ProgressStore>()(
  persist(
    (set, get) => {
      const commit = (result: { data: ProgressData; outcome: ActivityOutcome }) => {
        const toasts: Toast[] = [];
        if (result.outcome.xp > 0)
          toasts.push({
            id: uid(),
            kind: 'xp',
            text: 'toast.xp',
            params: { xp: result.outcome.xp },
          });
        for (const badge of result.outcome.badges) {
          toasts.push({ id: uid(), kind: 'badge', text: 'toast.badge', params: { badge } });
        }
        for (const _ of result.outcome.challenges)
          toasts.push({ id: uid(), kind: 'challenge', text: 'toast.challenge' });
        set({ ...result.data, toasts: [...get().toasts, ...toasts].slice(-4) });
        return result.outcome;
      };
      return {
        ...initialProgress(),
        toasts: [],
        dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
        pushToast: (toast) => set({ toasts: [...get().toasts, { ...toast, id: uid() }].slice(-4) }),
        recordPuzzle: (puzzle, solved, arm, serverRating) =>
          commit(applyPuzzle(pickData(get()), puzzle, solved, arm, serverRating)),
        recordGame: (record) => commit(applyGame(pickData(get()), record)),
        recordAnalysis: (accuracy, phaseErrors, gameId) =>
          commit(applyAnalysis(pickData(get()), accuracy, phaseErrors, gameId)),
        recordOpeningReview: (cardId, quality) =>
          commit(applyOpeningReview(pickData(get()), cardId, quality)),
        recordLesson: (lessonId) => commit(applyLesson(pickData(get()), lessonId)),
        recordEndgame: (drillId) => commit(applyEndgame(pickData(get()), drillId)),
        addPersonalPuzzles: (puzzles) => {
          const existing = new Set(get().personalPuzzles.map((p) => p.id));
          const fresh = puzzles.filter((p) => !existing.has(p.id));
          set({ personalPuzzles: cap([...get().personalPuzzles, ...fresh], 100) });
          return fresh.length;
        },
        removePersonalPuzzle: (id) =>
          set({ personalPuzzles: get().personalPuzzles.filter((p) => p.id !== id) }),
        importSnapshot: (data) => set({ ...data }),
        reset: () => set({ ...initialProgress(), toasts: [] }),
      };
    },
    {
      name: 'ia-ajedrez:progress',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => pickData(state),
    },
  ),
);
