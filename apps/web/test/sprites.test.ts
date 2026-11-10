import { describe, expect, it } from 'vitest';
import { BASE, FRAMES, PALETTE, SIZE, frames } from '../src/components/Board/sprites';

describe('piezas en pixel art', () => {
  for (const type of ['p', 'n', 'b', 'r', 'q', 'k']) {
    it(`la pieza ${type} tiene 6 cuadros de 32×32 y solo usa colores de la paleta`, () => {
      const all = frames(type);
      expect(all).toHaveLength(FRAMES);
      for (const rows of all) {
        expect(rows).toHaveLength(SIZE);
        for (const row of rows) {
          expect(row.length, `${type}: "${row}"`).toBe(SIZE);
          for (const c of row)
            expect(c === '.' || c in PALETTE.w, `${type}: carácter ${c}`).toBe(true);
        }
      }
    });

    it(`la pieza ${type} apoya en la última fila y tiene ojos`, () => {
      expect(BASE[type]!.at(-1)).toMatch(/o/);
      expect(BASE[type]!.join('')).toContain('e');
    });
  }

  it('los cuadros se distinguen entre sí', () => {
    for (const type of ['p', 'n', 'b', 'r', 'q', 'k']) {
      expect(new Set(frames(type).map((f) => f.join('|'))).size, type).toBeGreaterThanOrEqual(5);
    }
  });
});
