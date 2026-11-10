/** Texto en español o inglés para los hechos del tutor por reglas. */
import type { TutorFact } from './explain.js';

export type Locale = 'es' | 'en';

const PIECES: Record<Locale, Record<string, string>> = {
  es: { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' },
  en: { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' },
};

const FEMININE_ES = new Set(['q', 'r']);

const pawnsText = (n: number, locale: Locale) => {
  const v = Math.round(n * 10) / 10;
  return locale === 'es'
    ? `${v} ${v === 1 ? 'peón' : 'peones'}`
    : `${v} ${v === 1 ? 'pawn' : 'pawns'}`;
};

const fmtEval = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;

export function pieceName(piece: string, locale: Locale): string {
  return PIECES[locale][piece.toLowerCase()] ?? piece;
}

export function renderFact(fact: TutorFact, locale: Locale): string {
  const es = locale === 'es';
  const piece = (p: string) => pieceName(p, locale);
  switch (fact.code) {
    case 'givesMate':
      return es ? '¡Jaque mate! Partida terminada.' : 'Checkmate! Game over.';
    case 'givesCheck':
      return es
        ? 'La jugada da jaque y obliga al rival a responder.'
        : 'The move gives check and forces a reply.';
    case 'capture':
      return es
        ? `Capturas ${FEMININE_ES.has(fact.piece) ? 'la' : 'el'} ${piece(fact.piece)} en ${fact.square}.`
        : `You capture the ${piece(fact.piece)} on ${fact.square}.`;
    case 'castles':
      return es
        ? 'Enrocas: el rey queda más seguro y la torre se activa.'
        : 'You castle: king safety and an active rook.';
    case 'promotes':
      return es ? 'Coronas un peón.' : 'You promote a pawn.';
    case 'hangingPiece':
      return es
        ? `Tu ${piece(fact.piece)} en ${fact.square} queda ${FEMININE_ES.has(fact.piece) ? 'atacada' : 'atacado'} y sin defensa suficiente.`
        : `Your ${piece(fact.piece)} on ${fact.square} is attacked and not sufficiently defended.`;
    case 'allowsMate':
      return es
        ? `Esta jugada permite al rival dar mate en ${fact.moves}.`
        : `This move allows mate in ${fact.moves}.`;
    case 'missedMate':
      return es
        ? `Tenías mate en ${fact.moves} empezando por ${fact.san}.`
        : `You had mate in ${fact.moves} starting with ${fact.san}.`;
    case 'losesMaterial':
      return es
        ? `Tras ${fact.line.join(' ')} pierdes unos ${pawnsText(fact.pawns, locale)} de material.`
        : `After ${fact.line.join(' ')} you lose about ${pawnsText(fact.pawns, locale)} of material.`;
    case 'bestWasFork':
      return es
        ? `${fact.san} era un ataque doble (horquilla) sobre ${fact.targets.map((t) => `${piece(t[0]!)} ${t.slice(1)}`).join(' y ')}.`
        : `${fact.san} was a fork hitting ${fact.targets.map((t) => `${piece(t[0]!)} ${t.slice(1)}`).join(' and ')}.`;
    case 'bestWinsMaterial':
      return es
        ? `${fact.san} ganaba unos ${pawnsText(fact.pawns, locale)}.`
        : `${fact.san} won about ${pawnsText(fact.pawns, locale)}.`;
    case 'betterMove':
      return es
        ? `Mejor era ${fact.san}${fact.line.length > 1 ? ` (${fact.line.join(' ')})` : ''}.`
        : `Better was ${fact.san}${fact.line.length > 1 ? ` (${fact.line.join(' ')})` : ''}.`;
    case 'evalSwing':
      return es
        ? `La evaluación pasa de ${fmtEval(fact.before)} a ${fmtEval(fact.after)} para ti.`
        : `The evaluation goes from ${fmtEval(fact.before)} to ${fmtEval(fact.after)} for you.`;
    case 'solidMove':
      return es
        ? 'Jugada sólida: mantiene la valoración de la posición.'
        : 'Solid move: it keeps the evaluation.';
  }
}

export function renderFacts(facts: TutorFact[], locale: Locale): string {
  return facts.map((f) => renderFact(f, locale)).join(' ');
}
