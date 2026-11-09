/**
 * Informe de una partida a partir de las evaluaciones del motor en cada posición.
 * Es una función pura: quien la llama (web o servidor) se encarga de ejecutar el motor.
 */
import { scoreToCp, type Score } from '../engine/uci.js';
import { classifyMove, isError, MOVE_CLASSES, type MoveClass } from './classify.js';
import { gamePhase, type GamePhase } from './phase.js';
import { gameAccuracy, moveAccuracy, winPercent } from './winrate.js';

export interface PositionEval {
  /** Evaluación desde el punto de vista de las blancas. */
  score: Score;
  bestUci?: string;
  pv?: string[];
  depth?: number;
}

export interface MoveInput {
  san: string;
  uci: string;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  thinkTimeMs?: number;
  isBook?: boolean;
}

export interface AnalyzedMove extends MoveInput {
  ply: number;
  classification: MoveClass;
  /** % de victoria del que mueve, antes y después. */
  winBefore: number;
  winAfter: number;
  winDrop: number;
  accuracy: number;
  centipawnLoss: number;
  evalBefore: Score;
  evalAfter: Score;
  bestUci?: string;
  bestPv?: string[];
  phase: GamePhase;
}

export interface ColorSummary {
  accuracy: number | null;
  acpl: number;
  counts: Record<MoveClass, number>;
  errorsByPhase: Record<GamePhase, number>;
  averageThinkMs: number | null;
  moves: number;
}

export interface GameReport {
  moves: AnalyzedMove[];
  whiteWinPercents: number[];
  summary: { w: ColorSummary; b: ColorSummary };
}

function emptySummary(): ColorSummary {
  return {
    accuracy: null,
    acpl: 0,
    counts: Object.fromEntries(MOVE_CLASSES.map((c) => [c, 0])) as Record<MoveClass, number>,
    errorsByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    averageThinkMs: null,
    moves: 0,
  };
}

const forMover = (score: Score, color: 'w' | 'b'): Score =>
  color === 'w' ? score : { type: score.type, value: -score.value };

export function buildGameReport(moves: MoveInput[], evals: PositionEval[]): GameReport {
  if (evals.length !== moves.length + 1) {
    throw new Error(`Se esperaban ${moves.length + 1} evaluaciones y llegaron ${evals.length}`);
  }
  const whiteWinPercents = evals.map((e) => winPercent(e.score));
  const analyzed: AnalyzedMove[] = moves.map((move, i) => {
    const before = evals[i]!;
    const after = evals[i + 1]!;
    const moverBefore = forMover(before.score, move.color);
    const moverAfter = forMover(after.score, move.color);
    const winBefore = winPercent(moverBefore);
    const winAfter = winPercent(moverAfter);
    const cpBefore = Math.max(-1000, Math.min(1000, scoreToCp(moverBefore)));
    const cpAfter = Math.max(-1000, Math.min(1000, scoreToCp(moverAfter)));
    const classification = classifyMove({
      winBefore,
      winAfter,
      playedUci: move.uci,
      bestUci: before.bestUci,
      isBook: move.isBook,
    });
    return {
      ...move,
      ply: i + 1,
      classification,
      winBefore,
      winAfter,
      winDrop: Math.max(0, winBefore - winAfter),
      accuracy: moveAccuracy(winBefore, winAfter),
      centipawnLoss: Math.max(0, cpBefore - cpAfter),
      evalBefore: before.score,
      evalAfter: after.score,
      bestUci: before.bestUci,
      bestPv: before.pv,
      phase: gamePhase(move.fenBefore),
    };
  });

  const summary = { w: emptySummary(), b: emptySummary() };
  for (const color of ['w', 'b'] as const) {
    const own = analyzed.filter((m) => m.color === color);
    const s = summary[color];
    s.moves = own.length;
    s.accuracy = gameAccuracy(whiteWinPercents, color);
    s.acpl = own.length ? own.reduce((a, m) => a + m.centipawnLoss, 0) / own.length : 0;
    for (const m of own) {
      s.counts[m.classification]++;
      if (isError(m.classification)) s.errorsByPhase[m.phase]++;
    }
    const timed = own.filter((m) => typeof m.thinkTimeMs === 'number');
    s.averageThinkMs = timed.length
      ? timed.reduce((a, m) => a + (m.thinkTimeMs ?? 0), 0) / timed.length
      : null;
  }
  return { moves: analyzed, whiteWinPercents, summary };
}
