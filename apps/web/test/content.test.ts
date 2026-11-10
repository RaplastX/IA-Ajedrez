import {
  buildOpeningIndex,
  drillSteps,
  playPuzzleMove,
  startPuzzle,
  type OpeningEntry,
  type Puzzle,
} from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { ENDGAMES } from '../src/data/endgames';
import { LESSONS } from '../src/data/lessons';
import openings from '../src/data/openings.json';
import puzzles from '../src/data/puzzles.json';
import { REPERTOIRE } from '../src/data/repertoire';

const stripCheck = (san: string) => san.replace(/[+#]/g, '');

describe('banco de puzzles', () => {
  it('cada puzzle se resuelve jugando su solución', () => {
    for (const puzzle of puzzles as Puzzle[]) {
      let state = startPuzzle(puzzle);
      while (state.status === 'playing') {
        const result = playPuzzleMove(state, puzzle.moves[state.index]!);
        expect(result.correct, puzzle.id).toBe(true);
        state = result.state;
      }
      expect(state.status, puzzle.id).toBe('solved');
    }
  });

  it('cubre un rango amplio de dificultad y temas', () => {
    const ratings = (puzzles as Puzzle[]).map((p) => p.rating);
    expect(Math.min(...ratings)).toBeLessThan(700);
    expect(Math.max(...ratings)).toBeGreaterThan(2400);
    const themes = new Set((puzzles as Puzzle[]).flatMap((p) => p.themes));
    for (const t of ['fork', 'pin', 'mateIn1', 'mateIn2', 'endgame', 'skewer'])
      expect(themes.has(t), t).toBe(true);
  });
});

describe('repertorio', () => {
  const index = buildOpeningIndex(openings as OpeningEntry[]);
  it('todas las líneas son legales y tienen pasos para el usuario', () => {
    for (const line of REPERTOIRE) {
      const chess = new Chess();
      for (const san of line.moves)
        expect(() => chess.move(san), `${line.id} ${san}`).not.toThrow();
      expect(drillSteps(line).length).toBeGreaterThan(2);
    }
  });
  it('el índice de aperturas reconoce las líneas', () => {
    expect(index.size).toBeGreaterThan(3000);
    const chess = new Chess();
    for (const san of ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'])
      chess.move(san);
    expect(index.get(chess.fen().split(' ').slice(0, 4).join(' '))?.name).toMatch(/Najdorf/);
  });
});

describe('finales', () => {
  it('los FEN son válidos y tienen ≤ 7 piezas (aptos para tablebase)', () => {
    for (const drill of ENDGAMES) {
      const chess = new Chess(drill.fen);
      expect(chess.isGameOver(), drill.id).toBe(false);
      expect(drill.fen.split(' ')[0]!.replace(/[^a-zA-Z]/g, '').length).toBeLessThanOrEqual(7);
    }
  });
});

describe('lecciones', () => {
  it('las jugadas aceptadas son legales en su posición', () => {
    for (const lesson of LESSONS) {
      for (const step of lesson.steps) {
        const chess = new Chess(step.fen);
        const legal = new Set(chess.moves().map(stripCheck));
        for (const san of step.accept ?? [])
          expect(legal.has(san), `${lesson.id}: ${san}`).toBe(true);
      }
    }
  });

  it('las lecciones de mate realmente dan mate', () => {
    const mates = [
      ['6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'Ra8'],
      ['7k/8/6K1/8/8/8/8/Q7 w - - 0 1', 'Qa8'],
    ] as const;
    for (const [fen, san] of mates) {
      const chess = new Chess(fen);
      chess.move(san);
      expect(chess.isCheckmate()).toBe(true);
    }
  });
});
