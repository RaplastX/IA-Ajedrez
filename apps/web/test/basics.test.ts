import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { BASICS } from '../src/data/basics';

const strip = (san: string) => san.replace(/[+#]/g, '');

describe('curso desde cero', () => {
  it('tiene 14 lecciones con texto en español e inglés', () => {
    expect(BASICS).toHaveLength(14);
    for (const lesson of BASICS) {
      expect(lesson.title.es && lesson.title.en).toBeTruthy();
      for (const step of lesson.steps) {
        expect(step.text.es.length).toBeGreaterThan(10);
        expect(step.text.en.length).toBeGreaterThan(10);
      }
    }
  });

  it('cada ejercicio se resuelve con su primera jugada y las prácticas libres tienen piezas que mover', () => {
    for (const lesson of BASICS) {
      for (const step of lesson.steps) {
        const chess = new Chess(step.fen);
        if (step.accept) {
          const move = chess.moves().find((m) => strip(m) === step.accept![0]);
          expect(move, `${lesson.id}: ${step.accept[0]}`).toBeDefined();
        }
        if (step.explore) expect(chess.moves().length, lesson.id).toBeGreaterThan(0);
      }
    }
  });

  it('la lección de aperturas y el mate del pastor encadenan posiciones reales', () => {
    const line = (id: string, moves: string[]) => {
      const steps = BASICS.find((l) => l.id === id)!.steps.filter((s) => s.accept);
      const chess = new Chess();
      let i = 0;
      for (const san of moves) {
        if (chess.turn() === 'w') {
          expect(steps[i]!.fen.split(' ').slice(0, 4).join(' ')).toBe(
            chess.fen().split(' ').slice(0, 4).join(' '),
          );
          expect(strip(san)).toBe(steps[i]!.accept![0]);
          i++;
        }
        chess.move(san);
      }
      return chess;
    };
    line('b13-first-moves', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
    expect(
      line('b14-scholars-mate', ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']).isCheckmate(),
    ).toBe(true);
  });

  it('el mate del pasillo y el ahogado son lo que dice el texto', () => {
    const mate = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    mate.move('Ra8');
    expect(mate.isCheckmate()).toBe(true);
    expect(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').isStalemate()).toBe(true);
  });
});
