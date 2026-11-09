/**
 * Reconocimiento de aperturas y entrenador de repertorio.
 * Los nombres proceden del repositorio lichess-org/chess-openings (CC0).
 */
import { Chess } from 'chess.js';
import { positionKey } from '../pgn/pgn.js';

export interface OpeningEntry {
  eco: string;
  name: string;
  /** Jugadas en SAN separadas por espacios, sin números. */
  moves: string;
}

export type OpeningIndex = Map<string, OpeningEntry>;

/** Construye un índice posición → apertura (la línea más larga gana en caso de transposición). */
export function buildOpeningIndex(entries: OpeningEntry[]): OpeningIndex {
  const index: OpeningIndex = new Map();
  for (const entry of entries) {
    const chess = new Chess();
    try {
      for (const san of entry.moves.split(' ').filter(Boolean)) chess.move(san);
    } catch {
      continue;
    }
    const key = positionKey(chess.fen());
    const prev = index.get(key);
    if (!prev || prev.moves.length < entry.moves.length) index.set(key, entry);
  }
  return index;
}

/** Apertura más específica alcanzada por una secuencia de posiciones (FEN tras cada jugada). */
export function detectOpening(fens: string[], index: OpeningIndex): { entry: OpeningEntry; ply: number } | null {
  let found: { entry: OpeningEntry; ply: number } | null = null;
  fens.forEach((fen, i) => {
    const entry = index.get(positionKey(fen));
    if (entry) found = { entry, ply: i + 1 };
  });
  return found;
}

export interface RepertoireLine {
  id: string;
  name: string;
  eco: string;
  /** Color que entrena el usuario. */
  color: 'w' | 'b';
  moves: string[];
  ideas?: { es: string; en: string };
}

export interface DrillStep {
  /** Índice (ply) de la jugada que el usuario debe encontrar. */
  ply: number;
  fen: string;
  expectedSan: string;
  cardId: string;
}

/** Posiciones de la línea en las que le toca mover al usuario (cada una es una tarjeta SRS). */
export function drillSteps(line: RepertoireLine): DrillStep[] {
  const chess = new Chess();
  const steps: DrillStep[] = [];
  line.moves.forEach((san, ply) => {
    if (chess.turn() === line.color) {
      steps.push({ ply, fen: chess.fen(), expectedSan: san, cardId: `${line.id}:${ply}` });
    }
    chess.move(san);
  });
  return steps;
}
