/**
 * Generador de ejercicios a partir de los errores del usuario ("lecciones adaptativas").
 * Convierte cada error grave en un puzzle con el formato de Lichess: la posición antes de la
 * jugada previa del rival, esa jugada como "preparación" y la mejor continuación como solución.
 */
import type { GameReport, Puzzle } from '@ia-ajedrez/core';

export function puzzlesFromMistakes(
  report: GameReport,
  playerColor: 'w' | 'b',
  gameId: string,
  rating: number,
): Puzzle[] {
  const puzzles: Puzzle[] = [];
  report.moves.forEach((move, i) => {
    if (move.color !== playerColor || i === 0) return;
    if (move.classification !== 'mistake' && move.classification !== 'blunder') return;
    const pv = move.bestPv ?? (move.bestUci ? [move.bestUci] : []);
    if (pv.length === 0 || pv[0] === move.uci) return;
    const previous = report.moves[i - 1]!;
    // La solución termina siempre en una jugada del usuario (longitud impar).
    const solution = pv.length >= 3 ? pv.slice(0, 3) : pv.slice(0, 1);
    puzzles.push({
      id: `mine-${gameId}-${move.ply}`,
      fen: previous.fenBefore,
      moves: [previous.uci, ...solution],
      rating: Math.round(rating),
      themes: ['personal', move.phase],
    });
  });
  return puzzles;
}
