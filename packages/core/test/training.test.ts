import { describe, expect, it } from 'vitest';
import {
  chooseDifficultyArm,
  createDifficultyModel,
  expectedSuccess,
  isDue,
  mulberry32,
  newCard,
  qualityFromAnswer,
  recommendThemes,
  recordDifficultyResult,
  recordThemeResult,
  reviewCard,
  updatePuzzleRating,
  updateRating,
} from '../src/index.js';

describe('Glicko-2', () => {
  it('reproduce el ejemplo del artículo de Glickman', () => {
    const result = updateRating({ rating: 1500, rd: 200, volatility: 0.06 }, [
      { opponent: { rating: 1400, rd: 30 }, score: 1 },
      { opponent: { rating: 1550, rd: 100 }, score: 0 },
      { opponent: { rating: 1700, rd: 300 }, score: 0 },
    ]);
    expect(result.rating).toBeCloseTo(1464.06, 1);
    expect(result.rd).toBeCloseTo(151.52, 1);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });

  it('sube al resolver y baja al fallar', () => {
    const start = { rating: 1500, rd: 120, volatility: 0.06 };
    expect(updatePuzzleRating(start, 1600, true).rating).toBeGreaterThan(1500);
    expect(updatePuzzleRating(start, 1400, false).rating).toBeLessThan(1500);
    expect(updatePuzzleRating({ ...start, rd: 46 }, 1500, true).rd).toBeGreaterThanOrEqual(45);
  });
});

describe('dificultad adaptativa (bandido)', () => {
  it('aprende que un brazo es demasiado difícil', () => {
    let model = createDifficultyModel();
    for (let i = 0; i < 30; i++) model = recordDifficultyResult(model, 0, false);
    expect(expectedSuccess(model, 0)).toBeLessThan(0.2);
    const random = mulberry32(42);
    const picks = Array.from({ length: 200 }, () => chooseDifficultyArm(model, random));
    const zeroShare = picks.filter((p) => p === 0).length / picks.length;
    expect(zeroShare).toBeLessThan(0.1);
  });

  it('con los priors tiende a ejercicios accesibles', () => {
    const random = mulberry32(7);
    const picks = Array.from({ length: 300 }, () =>
      chooseDifficultyArm(createDifficultyModel(), random),
    );
    const counts = new Map<number, number>();
    for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
    // El brazo más difícil (+300, prior 20 % de acierto) casi nunca está cerca del 70 % objetivo.
    expect(counts.get(300) ?? 0).toBeLessThan(15);
  });
});

describe('debilidades', () => {
  it('recomienda primero el tema con peor acierto', () => {
    let stats = {};
    for (let i = 0; i < 10; i++) {
      stats = recordThemeResult(stats, ['fork'], true, '2026-01-01');
      stats = recordThemeResult(stats, ['pin'], false, '2026-01-01');
    }
    const recs = recommendThemes(stats, { catalog: ['fork', 'pin'], limit: 2 });
    expect(recs[0]!.theme).toBe('pin');
    expect(recs[0]!.reason).toBe('lowSuccess');
    expect(recs[1]!.reason).toBe('review');
  });

  it('prioriza la fase donde se cometen errores en partidas', () => {
    const recs = recommendThemes(
      {},
      {
        catalog: ['opening', 'middlegame', 'endgame'],
        phaseErrors: { endgame: 8, opening: 1 },
        limit: 1,
      },
    );
    expect(recs[0]).toMatchObject({ theme: 'endgame', reason: 'gameErrors' });
  });
});

describe('SM-2', () => {
  const day0 = new Date('2026-03-01T10:00:00Z');
  it('alarga intervalos con buenas respuestas y reinicia con fallos', () => {
    let card = newCard('ruy:4', day0);
    expect(isDue(card, day0)).toBe(true);
    card = reviewCard(card, 5, day0);
    expect(card.intervalDays).toBe(1);
    card = reviewCard(card, 5, day0);
    expect(card.intervalDays).toBe(6);
    card = reviewCard(card, 4, day0);
    expect(card.intervalDays).toBeGreaterThan(6);
    expect(isDue(card, day0)).toBe(false);
    card = reviewCard(card, 1, day0);
    expect(card).toMatchObject({ intervalDays: 1, repetitions: 0, lapses: 1 });
    expect(card.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('deriva la calidad del acierto y el tiempo', () => {
    expect(qualityFromAnswer(true, 2000)).toBe(5);
    expect(qualityFromAnswer(true, 30000)).toBe(3);
    expect(qualityFromAnswer(false, 1000)).toBeLessThan(3);
  });
});
