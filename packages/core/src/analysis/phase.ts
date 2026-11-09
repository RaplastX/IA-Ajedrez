/** Detección aproximada de la fase de la partida a partir del material del FEN. */

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

const PHASE_WEIGHTS: Record<string, number> = { n: 1, b: 1, r: 2, q: 4 };
/** Material de piezas (sin peones ni reyes) de la posición inicial: 4·1 + 4·1 + 4·2 + 2·4. */
const MAX_PHASE = 24;

export function phaseMaterial(fen: string): number {
  const board = fen.split(' ')[0] ?? '';
  let total = 0;
  for (const ch of board) total += PHASE_WEIGHTS[ch.toLowerCase()] ?? 0;
  return total;
}

export function gamePhase(fen: string, fullmove?: number): GamePhase {
  const move = fullmove ?? Number(fen.split(' ')[5] ?? '1');
  const material = phaseMaterial(fen);
  if (material <= 10) return 'endgame';
  if (move <= 12 && material >= MAX_PHASE - 4) return 'opening';
  return 'middlegame';
}

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Balance material (blancas − negras) en peones. */
export function materialBalance(fen: string): number {
  const board = fen.split(' ')[0] ?? '';
  let balance = 0;
  for (const ch of board) {
    const value = PIECE_VALUES[ch.toLowerCase()];
    if (value === undefined) continue;
    balance += ch === ch.toUpperCase() ? value : -value;
  }
  return balance;
}

export function pieceValue(piece: string): number {
  return PIECE_VALUES[piece.toLowerCase()] ?? 0;
}
