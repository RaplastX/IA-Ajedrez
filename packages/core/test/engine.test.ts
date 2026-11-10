import { describe, expect, it } from 'vitest';
import {
  formatScore,
  parseBestMove,
  parseInfo,
  pickHumanMove,
  scoreToCp,
  strengthForElo,
  toWhitePerspective,
  STOCKFISH_MIN_UCI_ELO,
} from '../src/index.js';

describe('UCI', () => {
  it('analiza una línea info completa', () => {
    const info = parseInfo(
      'info depth 18 seldepth 25 multipv 2 score cp -34 upperbound nodes 123456 nps 900000 time 137 pv e7e5 g1f3 b8c6',
    );
    expect(info).toEqual({
      depth: 18,
      seldepth: 25,
      multipv: 2,
      score: { type: 'cp', value: -34 },
      bound: 'upper',
      nodes: 123456,
      nps: 900000,
      time: 137,
      pv: ['e7e5', 'g1f3', 'b8c6'],
    });
  });

  it('analiza mates e ignora líneas sin puntuación', () => {
    expect(parseInfo('info depth 5 score mate -3 pv h7h6')?.score).toEqual({
      type: 'mate',
      value: -3,
    });
    expect(parseInfo('info depth 10 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfo('info string NNUE evaluation enabled')).toBeNull();
    expect(parseInfo('readyok')).toBeNull();
  });

  it('analiza bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({
      bestmove: 'e2e4',
      ponder: 'e7e5',
    });
    expect(parseBestMove('bestmove (none)')).toEqual({ bestmove: null });
    expect(parseBestMove('info depth 1')).toBeNull();
  });

  it('cambia la perspectiva y formatea', () => {
    expect(toWhitePerspective({ type: 'cp', value: 50 }, 'b')).toEqual({ type: 'cp', value: -50 });
    expect(formatScore({ type: 'cp', value: 35 })).toBe('+0.35');
    expect(formatScore({ type: 'mate', value: -2 })).toBe('-M2');
    expect(scoreToCp({ type: 'mate', value: 1 })).toBeGreaterThan(9000);
    expect(scoreToCp({ type: 'mate', value: -1 })).toBeLessThan(-9000);
  });
});

describe('fuerza del motor', () => {
  it('usa UCI_Elo a partir del mínimo de Stockfish', () => {
    const s = strengthForElo(1800);
    expect(s.uciOptions).toMatchObject({ UCI_LimitStrength: true, UCI_Elo: 1800 });
    expect(s.multipv).toBe(1);
  });

  it('por debajo del mínimo combina Skill Level, profundidad y temperatura', () => {
    const low = strengthForElo(400);
    const mid = strengthForElo(STOCKFISH_MIN_UCI_ELO - 20);
    expect(low.uciOptions['Skill Level']).toBe(0);
    expect(low.temperatureCp).toBeGreaterThan(mid.temperatureCp);
    expect(low.go.depth!).toBeLessThanOrEqual(mid.go.depth!);
    expect(strengthForElo(99999).elo).toBe(3000);
  });

  it('pickHumanMove es determinista con random inyectado', () => {
    const candidates = [
      { uci: 'e2e4', cp: 30 },
      { uci: 'a2a3', cp: -20 },
      { uci: 'g2g4', cp: -150 },
    ];
    expect(pickHumanMove(candidates, 0)?.uci).toBe('e2e4');
    expect(pickHumanMove(candidates, 100, () => 0)?.uci).toBe('e2e4');
    expect(pickHumanMove(candidates, 100, () => 0.999)?.uci).toBe('g2g4');
    expect(pickHumanMove([], 100)).toBeNull();
  });
});
