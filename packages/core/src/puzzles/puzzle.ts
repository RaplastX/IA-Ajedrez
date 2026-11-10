/**
 * Puzzles en el formato de la base de datos pública de Lichess (CC0):
 * el FEN es la posición ANTES de la jugada del rival; `moves[0]` es esa jugada y el resto
 * alterna solución del usuario / respuesta del rival.
 */
import { Chess } from 'chess.js';
import { uciToMoveObject } from '../pgn/pgn.js';

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  popularity?: number;
  plays?: number;
  gameUrl?: string;
  openingTags?: string[];
}

export interface PuzzleState {
  puzzle: Puzzle;
  /** Posición actual. */
  fen: string;
  /** Índice dentro de `puzzle.moves` de la próxima jugada que debe hacer el usuario. */
  index: number;
  playerColor: 'w' | 'b';
  status: 'playing' | 'solved' | 'failed';
  mistakes: number;
}

export function startPuzzle(puzzle: Puzzle): PuzzleState {
  const chess = new Chess(puzzle.fen);
  const setup = uciToMoveObject(puzzle.moves[0] ?? '');
  if (!setup) throw new Error(`Puzzle ${puzzle.id} sin jugada inicial válida`);
  chess.move(setup);
  return {
    puzzle,
    fen: chess.fen(),
    index: 1,
    playerColor: chess.turn(),
    status: 'playing',
    mistakes: 0,
  };
}

export interface PuzzleMoveResult {
  state: PuzzleState;
  correct: boolean;
  /** Respuesta automática del rival (UCI) si la solución continúa. */
  reply?: string;
}

/**
 * Comprueba la jugada del usuario. Como Lichess, acepta cualquier jugada que dé mate aunque no
 * sea la de la solución.
 */
export function playPuzzleMove(state: PuzzleState, uci: string): PuzzleMoveResult {
  if (state.status !== 'playing') return { state, correct: false };
  const expected = state.puzzle.moves[state.index];
  const chess = new Chess(state.fen);
  const moveObj = uciToMoveObject(uci);
  if (!moveObj) return { state, correct: false };
  let isMate = false;
  try {
    chess.move(moveObj);
    isMate = chess.isCheckmate();
  } catch {
    return { state, correct: false };
  }
  // Normaliza promociones: "e7e8" sin pieza se considera dama.
  const normalized =
    uci.length === 4 && expected?.length === 5 && expected.endsWith('q') ? `${uci}q` : uci;
  if (normalized !== expected && !isMate) {
    return { state: { ...state, status: 'failed', mistakes: state.mistakes + 1 }, correct: false };
  }
  if (isMate || state.index + 1 >= state.puzzle.moves.length) {
    return {
      state: { ...state, fen: chess.fen(), index: state.index + 1, status: 'solved' },
      correct: true,
    };
  }
  const reply = state.puzzle.moves[state.index + 1]!;
  chess.move(uciToMoveObject(reply)!);
  const next: PuzzleState = { ...state, fen: chess.fen(), index: state.index + 2 };
  if (next.index >= state.puzzle.moves.length) next.status = 'solved';
  return { state: next, correct: true, reply };
}

/** Pista: casilla de origen de la siguiente jugada de la solución. */
export function puzzleHint(state: PuzzleState): string | null {
  return state.puzzle.moves[state.index]?.slice(0, 2) ?? null;
}

/** Elige el puzzle más cercano a un rating objetivo, evitando los ya vistos. */
export function pickPuzzle(
  pool: Puzzle[],
  targetRating: number,
  options: { theme?: string; exclude?: Set<string>; random?: () => number } = {},
): Puzzle | null {
  const random = options.random ?? Math.random;
  const candidates = pool.filter(
    (p) => !options.exclude?.has(p.id) && (!options.theme || p.themes.includes(options.theme)),
  );
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort(
    (a, b) => Math.abs(a.rating - targetRating) - Math.abs(b.rating - targetRating),
  );
  // Un poco de variedad entre los 5 más cercanos.
  const top = sorted.slice(0, Math.min(5, sorted.length));
  return top[Math.floor(random() * top.length)]!;
}
