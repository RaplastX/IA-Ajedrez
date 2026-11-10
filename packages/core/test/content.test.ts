import { describe, expect, it } from 'vitest';
import {
  buildOpeningIndex,
  buildPgn,
  challengeProgress,
  dailyChallenges,
  dailyIndex,
  detectOpening,
  drillSteps,
  emptyStats,
  explainMove,
  levelFromXp,
  materialAfterLine,
  newlyEarnedBadges,
  parsePgn,
  pickPuzzle,
  playPuzzleMove,
  puzzleHint,
  splitPgnGames,
  startPuzzle,
  touchStreak,
  uciLineToSan,
  xpForGame,
  xpForLevel,
  xpForPuzzle,
  PgnError,
  type Puzzle,
  type TutorFact,
} from '../src/index.js';

describe('PGN', () => {
  it('importa cabeceras y jugadas', () => {
    const game = parsePgn(
      '[White "Ana"]\n[Black "Luis"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0',
    );
    expect(game.headers.White).toBe('Ana');
    expect(game.result).toBe('1-0');
    expect(game.moves.map((m) => m.uci)).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']);
    expect(game.moves[0]!.fenBefore).toContain('rnbqkbnr/pppppppp');
  });

  it('rechaza PGN vacío o ilegal', () => {
    expect(() => parsePgn('  ')).toThrow(PgnError);
    expect(() => parsePgn('1. e4 e5 2. Ke3 Ke6 3. Qh8')).toThrow(PgnError);
  });

  it('exporta desde UCI o SAN con comentarios y vuelve a importar', () => {
    const pgn = buildPgn(['e2e4', 'e5', 'g1f3'], {
      headers: { White: 'Yo' },
      comments: { 2: 'Simétrica' },
    });
    expect(pgn).toContain('[White "Yo"]');
    expect(pgn).toContain('{Simétrica}');
    expect(parsePgn(pgn).moves).toHaveLength(3);
  });

  it('divide archivos con varias partidas', () => {
    const text = '[Event "A"]\n\n1. e4 e5 *\n\n[Event "B"]\n\n1. d4 d5 *\n';
    const games = splitPgnGames(text);
    expect(games).toHaveLength(2);
    expect(parsePgn(games[1]!).moves[0]!.san).toBe('d4');
  });

  it('convierte variantes UCI a SAN', () => {
    expect(
      uciLineToSan('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [
        'g1f3',
        'g8f6',
        'zz',
      ]),
    ).toEqual(['Nf3', 'Nf6']);
  });
});

describe('puzzles (formato Lichess)', () => {
  const puzzle: Puzzle = {
    id: '0000D',
    fen: '5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27',
    moves: ['d3d6', 'f8d8', 'd6d8', 'f6d8'],
    rating: 1433,
    themes: ['advantage', 'endgame', 'short'],
  };

  it('aplica la jugada del rival y resuelve la secuencia', () => {
    let state = startPuzzle(puzzle);
    expect(state.playerColor).toBe('b');
    expect(puzzleHint(state)).toBe('f8');
    const first = playPuzzleMove(state, 'f8d8');
    expect(first).toMatchObject({ correct: true, reply: 'd6d8' });
    state = first.state;
    const second = playPuzzleMove(state, 'f6d8');
    expect(second.correct).toBe(true);
    expect(second.state.status).toBe('solved');
  });

  it('marca fallo con jugada incorrecta y acepta mates alternativos', () => {
    expect(playPuzzleMove(startPuzzle(puzzle), 'b6b3').state.status).toBe('failed');
    const mate: Puzzle = {
      id: 'mate',
      fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1',
      moves: ['h7h6', 'a1a8'],
      rating: 600,
      themes: ['mateIn1', 'backRankMate'],
    };
    expect(playPuzzleMove(startPuzzle(mate), 'a1a8').state.status).toBe('solved');
  });

  it('elige puzzles cerca del rating objetivo', () => {
    const pool = [600, 1000, 1500, 2000, 2500].map((rating, i) => ({
      ...puzzle,
      id: String(i),
      rating,
    }));
    expect(pickPuzzle(pool, 1950, { random: () => 0 })!.rating).toBe(2000);
    expect(pickPuzzle(pool, 1950, { exclude: new Set(['0', '1', '2', '3', '4']) })).toBeNull();
  });
});

describe('tutor por reglas', () => {
  it('detecta la dama colgada y la mejor jugada', () => {
    const facts = explainMove({
      fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
      playedUci: 'd8g5',
      classification: 'blunder',
      evalBefore: { type: 'cp', value: 40 },
      evalAfter: { type: 'cp', value: 900 },
      bestUci: 'b8c6',
      bestPv: ['b8c6', 'f1b5'],
      replyPv: ['f3g5', 'f8e7'],
    });
    expect(facts).toContainEqual({ code: 'hangingPiece', piece: 'q', square: 'g5' });
    expect(facts.find((f) => f.code === 'losesMaterial')).toMatchObject({ pawns: 9 });
    expect(facts.find((f) => f.code === 'betterMove')).toMatchObject({ san: 'Nc6' });
  });

  it('reconoce un mate y una horquilla perdida', () => {
    expect(
      explainMove({
        fenBefore: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        playedUci: 'a1a8',
        classification: 'best',
        evalBefore: { type: 'mate', value: 1 },
        evalAfter: { type: 'mate', value: 1 },
      }),
    ).toEqual([{ code: 'givesMate' }]);

    const facts = explainMove({
      fenBefore: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
      playedUci: 'e1d2',
      classification: 'mistake',
      evalBefore: { type: 'cp', value: 800 },
      evalAfter: { type: 'cp', value: 0 },
      bestUci: 'd5c7',
      bestPv: ['d5c7', 'e8d7', 'c7a8'],
    });
    expect(facts.find((f) => f.code === 'bestWasFork')).toMatchObject({
      san: 'Nc7+',
      targets: ['ra8', 'ke8'],
    });
    expect(facts.find((f) => f.code === 'bestWinsMaterial')).toMatchObject({ pawns: 5 });
  });

  it('calcula el material tras una variante con capturas', () => {
    // 1...Qg5?? 2.Nxg5: las negras pierden la dama.
    expect(
      materialAfterLine(
        'rnb1kbnr/pppp1ppp/8/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        ['f3g5'],
        'b',
      ),
    ).toBe(-9);
  });
});

describe('aperturas', () => {
  const index = buildOpeningIndex([
    { eco: 'C20', name: "King's Pawn Game", moves: 'e4 e5' },
    { eco: 'C60', name: 'Ruy Lopez', moves: 'e4 e5 Nf3 Nc6 Bb5' },
    { eco: 'X00', name: 'Ilegal', moves: 'e4 Ke7 Kf8' },
  ]);

  it('detecta la apertura más específica', () => {
    const fens = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6').moves.map((m) => m.fenAfter);
    expect(detectOpening(fens, index)).toMatchObject({ entry: { name: 'Ruy Lopez' }, ply: 5 });
    expect(index.size).toBe(2);
  });

  it('genera pasos de entrenamiento para el color del usuario', () => {
    const steps = drillSteps({
      id: 'ruy',
      name: 'Ruy',
      eco: 'C60',
      color: 'w',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    });
    expect(steps.map((s) => s.expectedSan)).toEqual(['e4', 'Nf3', 'Bb5']);
    expect(steps[1]!.cardId).toBe('ruy:2');
  });
});

describe('gamificación', () => {
  it('niveles crecientes', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(350).progress).toBeCloseTo(50 / 300);
  });

  it('XP por puzzle y partida', () => {
    expect(xpForPuzzle(true, 1800, 1500)).toBe(16);
    expect(xpForPuzzle(false, 1800, 1500)).toBe(2);
    expect(xpForGame('win', 1500)).toBeGreaterThan(xpForGame('draw', 1500));
    expect(xpForGame('loss', 3000)).toBe(10);
  });

  it('rachas diarias', () => {
    let s = touchStreak({ current: 0, longest: 0, lastActiveDay: null }, '2026-05-01');
    s = touchStreak(s, '2026-05-02');
    s = touchStreak(s, '2026-05-02');
    expect(s).toMatchObject({ current: 2, longest: 2 });
    s = touchStreak(s, '2026-05-05');
    expect(s).toMatchObject({ current: 1, longest: 2 });
  });

  it('insignias nuevas', () => {
    const stats = { ...emptyStats(), puzzlesSolved: 60, longestStreak: 3 };
    expect(newlyEarnedBadges(stats, ['firstPuzzle'])).toEqual(['puzzles50', 'streak3']);
  });

  it('retos diarios deterministas y sin contadores repetidos', () => {
    const a = dailyChallenges('2026-11-09');
    expect(a).toEqual(dailyChallenges('2026-11-09'));
    expect(new Set(a.map((c) => c.counter)).size).toBe(3);
    expect(dailyIndex('2026-11-09', 100)).toBe(dailyIndex('2026-11-09', 100));
    expect(challengeProgress(a[0]!, { [a[0]!.counter]: 1000 })).toBe(1);
  });
});

describe('render del tutor', () => {
  it('traduce hechos a español e inglés', async () => {
    const { renderFacts } = await import('../src/index.js');
    const facts: TutorFact[] = [
      { code: 'hangingPiece', piece: 'q', square: 'g5' },
      { code: 'betterMove', san: 'Nc6', line: ['Nc6', 'Bb5'] },
      { code: 'capture', piece: 'r', square: 'a8' },
    ];
    expect(renderFacts(facts, 'es')).toBe(
      'Tu dama en g5 queda atacada y sin defensa suficiente. Mejor era Nc6 (Nc6 Bb5). Capturas la torre en a8.',
    );
    expect(renderFacts(facts, 'en')).toContain('Your queen on g5 is attacked');
  });
});
