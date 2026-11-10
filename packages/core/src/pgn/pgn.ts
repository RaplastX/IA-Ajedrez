/** Importación y exportación de partidas en PGN sobre chess.js. */
import { Chess } from 'chess.js';
import type { MoveInput } from '../analysis/game.js';

export interface ParsedGame {
  headers: Record<string, string>;
  moves: MoveInput[];
  startFen: string;
  result: string;
}

export class PgnError extends Error {
  constructor(
    public readonly code: 'empty' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'PgnError';
  }
}

/** Divide un archivo con varias partidas (p. ej. una descarga de TWIC o Lichess). */
export function splitPgnGames(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const games: string[] = [];
  let current: string[] = [];
  let seenMoves = false;
  for (const line of normalized.split('\n')) {
    const isHeader = line.startsWith('[');
    if (isHeader && seenMoves) {
      games.push(current.join('\n').trim());
      current = [];
      seenMoves = false;
    }
    if (!isHeader && line.trim() !== '') seenMoves = true;
    current.push(line);
  }
  const last = current.join('\n').trim();
  if (last) games.push(last);
  return games;
}

export function parsePgn(pgn: string): ParsedGame {
  if (!pgn.trim()) throw new PgnError('empty', 'PGN vacío');
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch (error) {
    throw new PgnError('invalid', (error as Error).message);
  }
  const headers = chess.getHeaders();
  const history = chess.history({ verbose: true });
  const startFen = history[0]?.before ?? chess.fen();
  return {
    headers,
    startFen,
    result: headers.Result ?? '*',
    moves: history.map((m) => ({
      san: m.san,
      uci: m.lan,
      color: m.color,
      fenBefore: m.before,
      fenAfter: m.after,
    })),
  };
}

export interface BuildPgnOptions {
  headers?: Record<string, string>;
  startFen?: string;
  /** Comentarios por número de jugada (ply, empezando en 1). */
  comments?: Record<number, string>;
}

/** Construye un PGN a partir de jugadas SAN o UCI. */
export function buildPgn(moves: string[], options: BuildPgnOptions = {}): string {
  const chess = options.startFen ? new Chess(options.startFen) : new Chess();
  const headers: Record<string, string> = {
    Event: 'IA Ajedrez',
    Site: 'IA Ajedrez',
    ...(options.headers ?? {}),
  };
  if (options.startFen) {
    headers.SetUp = '1';
    headers.FEN = options.startFen;
  }
  for (const [key, value] of Object.entries(headers)) chess.setHeader(key, value);
  moves.forEach((move, i) => {
    chess.move(uciToMoveObject(move) ?? move);
    const comment = options.comments?.[i + 1];
    if (comment) chess.setComment(comment);
  });
  return chess.pgn();
}

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function uciToMoveObject(
  uci: string,
): { from: string; to: string; promotion?: string } | null {
  if (!UCI_RE.test(uci)) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci.length === 5 ? { promotion: uci[4] } : {}),
  };
}

/** Convierte una lista de jugadas UCI a SAN desde una posición. Se detiene en la primera ilegal. */
export function uciLineToSan(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves) {
    const move = uciToMoveObject(uci);
    if (!move) break;
    try {
      san.push(chess.move(move).san);
    } catch {
      break;
    }
  }
  return san;
}

/** Elimina contadores de jugada del FEN para comparar posiciones (estilo EPD). */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}
