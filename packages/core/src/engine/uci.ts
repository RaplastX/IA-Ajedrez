/**
 * Utilidades para el protocolo UCI (Universal Chess Interface).
 * Sirven igual para Stockfish (WASM en el navegador o nativo en el servidor) y Leela Chess Zero.
 */

export type Score = { type: 'cp'; value: number } | { type: 'mate'; value: number };

export interface InfoLine {
  depth: number;
  seldepth?: number;
  multipv: number;
  /** Puntuación desde el punto de vista del bando que mueve (convención UCI). */
  score?: Score;
  bound?: 'lower' | 'upper';
  nodes?: number;
  nps?: number;
  time?: number;
  pv: string[];
}

export interface BestMove {
  bestmove: string | null;
  ponder?: string;
}

const NUMERIC_FIELDS = ['depth', 'seldepth', 'multipv', 'nodes', 'nps', 'time'] as const;

/** Analiza una línea `info ...`. Devuelve `null` si no es una línea de búsqueda útil. */
export function parseInfo(line: string): InfoLine | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info' || !tokens.includes('depth')) return null;
  // Las líneas "info depth N currmove ..." no traen puntuación ni variante: se ignoran.
  if (!tokens.includes('score') && !tokens.includes('pv')) return null;

  const info: InfoLine = { depth: 0, multipv: 1, pv: [] };
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]!;
    if ((NUMERIC_FIELDS as readonly string[]).includes(token)) {
      const value = Number(tokens[i + 1]);
      if (Number.isFinite(value)) {
        (info as unknown as Record<string, number>)[token] = value;
      }
      i++;
    } else if (token === 'score') {
      const kind = tokens[i + 1];
      const value = Number(tokens[i + 2]);
      if ((kind === 'cp' || kind === 'mate') && Number.isFinite(value)) {
        info.score = { type: kind, value };
      }
      i += 2;
      const next = tokens[i + 1];
      if (next === 'lowerbound' || next === 'upperbound') {
        info.bound = next === 'lowerbound' ? 'lower' : 'upper';
        i++;
      }
    } else if (token === 'pv') {
      info.pv = tokens.slice(i + 1);
      break;
    }
  }
  return info;
}

/** Analiza una línea `bestmove e2e4 ponder e7e5`. */
export function parseBestMove(line: string): BestMove | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove') return null;
  const move = tokens[1];
  const result: BestMove = { bestmove: !move || move === '(none)' ? null : move };
  if (tokens[2] === 'ponder' && tokens[3]) result.ponder = tokens[3];
  return result;
}

/** Convierte una puntuación del bando que mueve a la perspectiva de las blancas. */
export function toWhitePerspective(score: Score, sideToMove: 'w' | 'b'): Score {
  return sideToMove === 'w' ? score : { type: score.type, value: -score.value };
}

/** Puntuación numérica en centipeones; los mates se acotan a ±(10000 - distancia). */
export function scoreToCp(score: Score): number {
  if (score.type === 'cp') return score.value;
  if (score.value === 0) return -10000; // mate ya dado contra el bando que mueve
  return Math.sign(score.value) * (10000 - Math.abs(score.value) * 10);
}

/** Texto corto para mostrar una evaluación: "+0.35", "-1.20", "M3", "-M2". */
export function formatScore(score: Score): string {
  if (score.type === 'mate') return `${score.value < 0 ? '-' : ''}M${Math.abs(score.value)}`;
  const pawns = score.value / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}
