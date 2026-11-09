/**
 * Tutor basado en reglas: convierte la salida del motor en "hechos" pedagógicos con código y
 * parámetros. La interfaz los traduce (es/en) y el tutor con LLM los usa como contexto fiable,
 * de modo que el modelo de lenguaje explica pero no se inventa la evaluación.
 */
import { Chess, type Square } from 'chess.js';
import type { MoveClass } from '../analysis/classify.js';
import { materialBalance, pieceValue } from '../analysis/phase.js';
import type { Score } from '../engine/uci.js';
import { uciLineToSan, uciToMoveObject } from '../pgn/pgn.js';

export type TutorFact =
  | { code: 'givesMate' }
  | { code: 'givesCheck' }
  | { code: 'capture'; piece: string; square: string }
  | { code: 'castles' }
  | { code: 'promotes' }
  | { code: 'hangingPiece'; piece: string; square: string }
  | { code: 'allowsMate'; moves: number }
  | { code: 'missedMate'; moves: number; san: string }
  | { code: 'losesMaterial'; pawns: number; line: string[] }
  | { code: 'bestWasFork'; san: string; targets: string[] }
  | { code: 'bestWinsMaterial'; san: string; pawns: number }
  | { code: 'betterMove'; san: string; line: string[] }
  | { code: 'evalSwing'; before: number; after: number }
  | { code: 'solidMove' };

export interface ExplainInput {
  fenBefore: string;
  playedUci: string;
  classification: MoveClass;
  /** Evaluaciones desde el punto de vista de las blancas. */
  evalBefore: Score;
  evalAfter: Score;
  bestUci?: string;
  bestPv?: string[];
  /** Mejor continuación del rival tras la jugada del usuario. */
  replyPv?: string[];
}

const pawnsForMover = (score: Score, color: 'w' | 'b') => {
  const v = score.type === 'cp' ? score.value / 100 : Math.sign(score.value) * 99;
  return color === 'w' ? v : -v;
};

/** Balance material (en peones, para `color`) tras seguir la variante hasta un punto "tranquilo". */
export function materialAfterLine(fen: string, line: string[], color: 'w' | 'b', maxPlies = 6): number {
  const chess = new Chess(fen);
  const sign = color === 'w' ? 1 : -1;
  const start = materialBalance(fen) * sign;
  let settled = start;
  for (let i = 0; i < Math.min(line.length, maxPlies); i++) {
    const move = uciToMoveObject(line[i]!);
    if (!move) break;
    try {
      chess.move(move);
    } catch {
      break;
    }
    const nextMove = line[i + 1] ? uciToMoveObject(line[i + 1]!) : null;
    const nextIsCapture = nextMove ? chess.get(nextMove.to as Square) !== undefined : false;
    if (!nextIsCapture || i + 1 >= maxPlies) settled = materialBalance(chess.fen()) * sign;
  }
  return settled - start;
}

function hangingPieces(chess: Chess, color: 'w' | 'b'): { piece: string; square: string }[] {
  const opponent = color === 'w' ? 'b' : 'w';
  const result: { piece: string; square: string; value: number }[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== color || cell.type === 'k' || cell.type === 'p') continue;
      const attackers = chess.attackers(cell.square, opponent);
      if (attackers.length === 0) continue;
      const defenders = chess.attackers(cell.square, color);
      const cheapestAttacker = Math.min(
        ...attackers.map((sq) => pieceValue(chess.get(sq)?.type ?? 'k') || 100),
      );
      const value = pieceValue(cell.type);
      if (defenders.length === 0 || cheapestAttacker < value) {
        result.push({ piece: cell.type, square: cell.square, value });
      }
    }
  }
  return result.sort((a, b) => b.value - a.value).map(({ piece, square }) => ({ piece, square }));
}

function forkTargets(fen: string, uci: string): string[] {
  const chess = new Chess(fen);
  const move = uciToMoveObject(uci);
  if (!move) return [];
  let mover: 'w' | 'b';
  let movedValue: number;
  try {
    const played = chess.move(move);
    mover = played.color;
    movedValue = pieceValue(played.promotion ?? played.piece);
  } catch {
    return [];
  }
  const targets: string[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color === mover || cell.type === 'p') continue;
      if (!chess.attackers(cell.square, mover).includes(move.to as Square)) continue;
      if (cell.type === 'k' || pieceValue(cell.type) > movedValue) targets.push(`${cell.type}${cell.square}`);
    }
  }
  return targets.length >= 2 ? targets : [];
}

export function explainMove(input: ExplainInput): TutorFact[] {
  const facts: TutorFact[] = [];
  const chess = new Chess(input.fenBefore);
  const color = chess.turn();
  const moveObj = uciToMoveObject(input.playedUci);
  if (!moveObj) return facts;
  let played;
  try {
    played = chess.move(moveObj);
  } catch {
    return facts;
  }

  if (chess.isCheckmate()) return [{ code: 'givesMate' }];
  if (played.isKingsideCastle() || played.isQueensideCastle()) facts.push({ code: 'castles' });
  if (played.isPromotion()) facts.push({ code: 'promotes' });
  if (played.captured) facts.push({ code: 'capture', piece: played.captured, square: played.to });
  if (chess.isCheck()) facts.push({ code: 'givesCheck' });

  const before = pawnsForMover(input.evalBefore, color);
  const after = pawnsForMover(input.evalAfter, color);
  const isErrorMove = ['inaccuracy', 'mistake', 'blunder'].includes(input.classification);

  // Mate que permitimos al rival.
  if (input.evalAfter.type === 'mate') {
    const mateForOpponent = color === 'w' ? input.evalAfter.value < 0 : input.evalAfter.value > 0;
    if (mateForOpponent) facts.push({ code: 'allowsMate', moves: Math.abs(input.evalAfter.value) });
  }
  // Mate que teníamos y no vimos.
  if (input.evalBefore.type === 'mate' && input.bestUci && input.bestUci !== input.playedUci) {
    const mateForUs = color === 'w' ? input.evalBefore.value > 0 : input.evalBefore.value < 0;
    const stillMate = input.evalAfter.type === 'mate' && Math.sign(input.evalAfter.value) === Math.sign(input.evalBefore.value);
    if (mateForUs && !stillMate) {
      const san = uciLineToSan(input.fenBefore, [input.bestUci])[0] ?? input.bestUci;
      facts.push({ code: 'missedMate', moves: Math.abs(input.evalBefore.value), san });
    }
  }

  if (isErrorMove) {
    const hanging = hangingPieces(chess, color)[0];
    if (hanging && input.classification !== 'inaccuracy') facts.push({ code: 'hangingPiece', ...hanging });
    if (input.replyPv?.length) {
      const loss = materialAfterLine(chess.fen(), input.replyPv, color);
      if (loss <= -2) {
        facts.push({
          code: 'losesMaterial',
          pawns: -loss,
          line: uciLineToSan(chess.fen(), input.replyPv.slice(0, 4)),
        });
      }
    }
    if (input.bestUci && input.bestUci !== input.playedUci) {
      const san = uciLineToSan(input.fenBefore, [input.bestUci])[0] ?? input.bestUci;
      const fork = forkTargets(input.fenBefore, input.bestUci);
      if (fork.length) facts.push({ code: 'bestWasFork', san, targets: fork });
      const gain = input.bestPv?.length ? materialAfterLine(input.fenBefore, input.bestPv, color) : 0;
      if (gain >= 2) facts.push({ code: 'bestWinsMaterial', san, pawns: gain });
      if (!facts.some((f) => f.code === 'missedMate')) {
        facts.push({
          code: 'betterMove',
          san,
          line: uciLineToSan(input.fenBefore, (input.bestPv ?? [input.bestUci]).slice(0, 5)),
        });
      }
    }
    if (Math.abs(before - after) >= 1 && Math.abs(before) < 50 && Math.abs(after) < 50) {
      facts.push({ code: 'evalSwing', before: round1(before), after: round1(after) });
    }
  } else if (facts.length === 0) {
    facts.push({ code: 'solidMove' });
  }
  return facts;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
