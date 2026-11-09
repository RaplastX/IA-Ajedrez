import { buildGameReport, parsePgn, type Puzzle } from '@ia-ajedrez/core';
import { describe, expect, it } from 'vitest';
import { puzzlesFromMistakes } from '../src/lib/mistakes';
import {
  applyActivity,
  applyAnalysis,
  applyGame,
  applyLesson,
  applyPuzzle,
  initialProgress,
  type GameRecord,
} from '../src/store/progress';

const puzzle: Puzzle = {
  id: 'p1',
  fen: '5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27',
  moves: ['d3d6', 'f8d8', 'd6d8', 'f6d8'],
  rating: 1600,
  themes: ['endgame', 'advantage'],
};

describe('transiciones de progreso', () => {
  it('un puzzle resuelto suma XP, rating, tema, racha e insignia', () => {
    const { data, outcome } = applyPuzzle(initialProgress(), puzzle, true, 0, undefined, '2026-11-09');
    expect(outcome.xp).toBeGreaterThanOrEqual(10);
    expect(outcome.badges).toContain('firstPuzzle');
    expect(data.stats.puzzlesSolved).toBe(1);
    expect(data.puzzleRating.rating).toBeGreaterThan(1500);
    expect(data.themeStats.endgame).toMatchObject({ attempts: 1, successes: 1 });
    expect(data.streak).toMatchObject({ current: 1, lastActiveDay: '2026-11-09' });
    expect(data.seenPuzzles).toEqual(['p1']);
    expect(data.daily.counters.puzzlesSolved).toBe(1);
  });

  it('un puzzle fallado baja el rating y no cuenta como resuelto', () => {
    const { data } = applyPuzzle(initialProgress(), puzzle, false, 0, undefined, '2026-11-09');
    expect(data.stats).toMatchObject({ puzzlesSolved: 0, puzzlesAttempted: 1 });
    expect(data.puzzleRating.rating).toBeLessThan(1500);
  });

  it('usa el rating del servidor cuando existe', () => {
    const server = { rating: 1720, rd: 90, volatility: 0.06 };
    expect(applyPuzzle(initialProgress(), puzzle, true, 0, server).data.puzzleRating).toEqual(server);
  });

  it('una victoria contra la IA registra el Elo vencido', () => {
    const record: GameRecord = {
      id: 'g1',
      date: '2026-11-09T10:00:00Z',
      mode: 'ai',
      pgn: '',
      result: '0-1',
      playerColor: 'b',
      opponent: 'Stockfish 1400',
      opponentElo: 1400,
    };
    const { data, outcome } = applyGame(initialProgress(), record, '2026-11-09');
    expect(data.stats).toMatchObject({ gamesPlayed: 1, gamesWon: 1, bestAiEloBeaten: 1400 });
    expect(outcome.badges).toEqual(expect.arrayContaining(['firstWin', 'beat1200']));
  });

  it('completa retos diarios una sola vez', () => {
    let data = initialProgress();
    let bonus = 0;
    for (let i = 0; i < 12; i++) {
      const r = applyPuzzle(data, { ...puzzle, id: `p${i}` }, true, 0, undefined, '2026-11-09');
      data = r.data;
      bonus += r.outcome.challenges.length;
    }
    const again = applyActivity(data, 0, 'puzzlesSolved', '2026-11-09');
    expect(again.outcome.challenges).toEqual([]);
    expect(data.daily.completed.length).toBe(bonus);
  });

  it('lecciones y análisis acumulan estadísticas', () => {
    let data = applyLesson(initialProgress(), 'center').data;
    data = applyLesson(data, 'center').data;
    expect(data.stats.lessonsCompleted).toBe(1);
    data = applyAnalysis(data, 91.5, { opening: 1, middlegame: 2, endgame: 0 }).data;
    expect(data.stats).toMatchObject({ analysesRun: 1, bestAccuracy: 92 });
    expect(data.phaseErrors.middlegame).toBe(2);
    expect(data.badges.accuracy90).toBeDefined();
  });
});

describe('ejercicios a partir de errores', () => {
  it('convierte un error grave en un puzzle resoluble', () => {
    const game = parsePgn('1. e4 e5 2. Nf3 Qh4 3. Nxh4 Nc6');
    const evals = [
      { score: { type: 'cp' as const, value: 30 }, bestUci: 'e2e4' },
      { score: { type: 'cp' as const, value: 30 }, bestUci: 'e7e5' },
      { score: { type: 'cp' as const, value: 30 }, bestUci: 'g1f3' },
      { score: { type: 'cp' as const, value: 40 }, bestUci: 'b8c6', pv: ['b8c6', 'f1b5', 'a7a6'] },
      { score: { type: 'cp' as const, value: 900 }, bestUci: 'f3h4' },
      { score: { type: 'cp' as const, value: 900 } },
      { score: { type: 'cp' as const, value: 900 } },
    ];
    const report = buildGameReport(game.moves, evals);
    const puzzles = puzzlesFromMistakes(report, 'b', 'g1', 1500);
    expect(puzzles).toHaveLength(1);
    expect(puzzles[0]).toMatchObject({ id: 'mine-g1-4', moves: ['g1f3', 'b8c6', 'f1b5', 'a7a6'], themes: ['personal', 'opening'] });
  });
});
