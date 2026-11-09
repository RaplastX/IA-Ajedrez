import { describe, expect, it } from 'vitest';
import {
  buildGameReport,
  classifyMove,
  gameAccuracy,
  gamePhase,
  materialBalance,
  moveAccuracy,
  parsePgn,
  winPercentFromCp,
  type PositionEval,
} from '../src/index.js';

describe('% de victoria y precisión', () => {
  it('es simétrico y acotado', () => {
    expect(winPercentFromCp(0)).toBeCloseTo(50);
    expect(winPercentFromCp(300) + winPercentFromCp(-300)).toBeCloseTo(100);
    expect(winPercentFromCp(5000)).toBeCloseTo(winPercentFromCp(1000));
  });

  it('la precisión es 100 sin pérdida y baja con la caída', () => {
    expect(moveAccuracy(60, 60)).toBe(100);
    expect(moveAccuracy(60, 55)).toBeGreaterThan(moveAccuracy(60, 40));
    expect(moveAccuracy(90, 0)).toBe(0);
  });

  it('precisión de partida perfecta cuando no cambia la evaluación', () => {
    expect(gameAccuracy([50, 50, 50, 50, 50], 'w')).toBeCloseTo(100, 0);
    expect(gameAccuracy([50], 'w')).toBeNull();
  });
});

describe('clasificación', () => {
  it('aplica los umbrales', () => {
    const base = { playedUci: 'e2e4', bestUci: 'd2d4' };
    expect(classifyMove({ ...base, winBefore: 50, winAfter: 49 })).toBe('excellent');
    expect(classifyMove({ ...base, winBefore: 50, winAfter: 47 })).toBe('good');
    expect(classifyMove({ ...base, winBefore: 50, winAfter: 43 })).toBe('inaccuracy');
    expect(classifyMove({ ...base, winBefore: 50, winAfter: 38 })).toBe('mistake');
    expect(classifyMove({ ...base, winBefore: 50, winAfter: 20 })).toBe('blunder');
    expect(classifyMove({ ...base, playedUci: 'd2d4', winBefore: 50, winAfter: 30 })).toBe('best');
    expect(classifyMove({ ...base, winBefore: 50, winAfter: 10, isBook: true })).toBe('book');
  });
});

describe('fase y material', () => {
  it('detecta fases', () => {
    expect(gamePhase('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe('opening');
    expect(gamePhase('8/5k2/8/8/8/2R5/5K2/8 w - - 0 50')).toBe('endgame');
    expect(gamePhase('r1bq1rk1/pp3ppp/2n2n2/3p4/3P4/2N2N2/PP3PPP/R1BQ1RK1 w - - 0 20')).toBe('middlegame');
  });
  it('calcula el balance', () => {
    expect(materialBalance('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')).toBe(5);
  });
});

describe('informe de partida', () => {
  const pgn = '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0';
  const game = parsePgn(pgn);
  // Evaluaciones simuladas (punto de vista blanco); 3...Nf6?? permite mate en 1.
  const evals: PositionEval[] = [
    { score: { type: 'cp', value: 30 }, bestUci: 'e2e4' },
    { score: { type: 'cp', value: 30 }, bestUci: 'e7e5' },
    { score: { type: 'cp', value: 25 }, bestUci: 'g1f3' },
    { score: { type: 'cp', value: -20 }, bestUci: 'b8c6' },
    { score: { type: 'cp', value: -10 }, bestUci: 'f1c4' },
    { score: { type: 'cp', value: -15 }, bestUci: 'g7g6' },
    { score: { type: 'mate', value: 1 }, bestUci: 'h5f7' },
    { score: { type: 'mate', value: 0 } },
  ];
  // La posición final es mate a las negras: desde el punto de vista blanco es victoria.
  evals[7] = { score: { type: 'mate', value: 1 } };
  const report = buildGameReport(game.moves, evals);

  it('clasifica la jugada que permite mate como blunder', () => {
    const nf6 = report.moves.find((m) => m.san === 'Nf6')!;
    expect(nf6.classification).toBe('blunder');
    expect(nf6.phase).toBe('opening');
    expect(report.moves.find((m) => m.san === 'Qxf7#')!.classification).toBe('best');
  });

  it('resume por color', () => {
    expect(report.summary.b.counts.blunder).toBe(1);
    expect(report.summary.b.errorsByPhase.opening).toBe(1);
    expect(report.summary.w.accuracy!).toBeGreaterThan(report.summary.b.accuracy!);
    expect(report.whiteWinPercents).toHaveLength(8);
  });

  it('exige una evaluación por posición', () => {
    expect(() => buildGameReport(game.moves, evals.slice(1))).toThrow();
  });
});
